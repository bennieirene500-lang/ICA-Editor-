import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';

import express from 'express';
import multer from 'multer';

import { detectSilence } from '../processor/detectSilence.js';
import { probeVideo } from '../processor/probeVideo.js';
import { buildPausePlan } from '../processor/buildPausePlan.js';
import { removePauses } from '../processor/removePauses.js';
import { extractAudio } from '../processor/extractAudio.js';
import { transcribeAudio } from '../processor/transcribeAudio.js';
import { analyseMeaning } from '../processor/analyseMeaning.js';
import { buildDirectorPlan } from '../processor/buildDirectorPlan.js';
import { renderDirectorVideo } from '../processor/renderDirectorVideo.js';
import { buildCaptionGroups } from '../processor/buildCaptions.js';
import { createProducerDecision } from '../producer/producerBrain.js';
import { buildVisualPlan } from '../visuals/buildVisualPlan.js';
import { createProductionAss } from '../visuals/createProductionAss.js';
import { renderProductionVideo } from '../visuals/renderProductionVideo.js';
import { buildSoundCues } from '../visuals/motionLibrary.js';

export function createCaptionRouter({
  uploadsDir,
  tempDir,
  outputsDir,
  ffmpegPath,
  maxFileBytes,
  requireUser,
  usageService,
  jobQueue,
  outputRegistry
}) {
  const router = express.Router();
  const upload = multer({
    dest: uploadsDir,
    limits: { fileSize: maxFileBytes, files: 1 },
    fileFilter: (_req, file, callback) => {
      if (!file.mimetype?.startsWith('video/')) {
        callback(new Error('ICA could not read this recording. Please choose another video.'));
        return;
      }
      callback(null, true);
    }
  });

  router.post('/caption-video', requireUser, upload.single('video'), async (req, res, next) => {
    const inputPath = req.file?.path;
    if (!req.file || !inputPath) return res.status(400).json({ error: 'Please select a video first.' });

    try {
      const result = await jobQueue.run(() => produceVideo({
        req,
        inputPath,
        uploadsDir,
        tempDir,
        outputsDir,
        ffmpegPath,
        usageService,
        outputRegistry
      }));
      res.json(result);
    } catch (error) {
      next(error);
    } finally {
      await fsp.rm(inputPath, { force: true }).catch(() => {});
    }
  });

  return router;
}

async function produceVideo({ req, inputPath, tempDir, outputsDir, ffmpegPath, usageService, outputRegistry }) {
  const communicationGoal = String(req.body?.communicationGoal || '').trim().toLowerCase();
  if (!communicationGoal) {
    const error = new Error('Tell ICA what you want this video to achieve.');
    error.status = 400;
    throw error;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const error = new Error('The OpenAI connection is not configured yet.');
    error.status = 503;
    error.code = 'OPENAI_NOT_CONFIGURED';
    throw error;
  }

  const jobId = crypto.randomUUID();
  const tightenedPath = path.join(tempDir, `${jobId}-tightened.mp4`);
  const directedPath = path.join(tempDir, `${jobId}-directed.mp4`);
  const audioPath = path.join(tempDir, `${jobId}.mp3`);
  const productionAssPath = path.join(tempDir, `${jobId}-production.ass`);
  const visualOnlyAssPath = path.join(tempDir, `${jobId}-visual-only.ass`);
  const outputPath = path.join(outputsDir, `${jobId}-produced.mp4`);

  let allowanceClaimed = false;
  let preserveOutputArtifacts = false;

  try {
    const originalMetadata = await probeVideo({ ffmpegPath, inputPath });
    const claim = await usageService.claim({
      user: req.auth.user,
      jobId,
      durationSeconds: originalMetadata.duration
    });

    if (!claim.allowed) {
      const error = new Error('You have used the videos included for this month.');
      error.status = 403;
      error.code = 'VIDEO_ALLOWANCE_EXHAUSTED';
      error.videosRemaining = claim.videosRemaining;
      throw error;
    }
    allowanceClaimed = true;

    const silenceRanges = await detectSilence({
      ffmpegPath,
      inputPath,
      noiseDb: -38,
      minimumSilenceSeconds: 0.85
    });

    const pausePlan = buildPausePlan({
      silenceRanges,
      videoDuration: originalMetadata.duration,
      preserveSeconds: 0.28,
      minimumRemovalSeconds: 0.42,
      maximumSingleRemovalSeconds: 2.5
    });

    await removePauses({
      ffmpegPath,
      inputPath,
      outputPath: tightenedPath,
      keepSegments: pausePlan.keepSegments
    });

    const tightenedMetadata = await probeVideo({ ffmpegPath, inputPath: tightenedPath });
    await extractAudio({ ffmpegPath, inputPath: tightenedPath, audioPath });

    const transcription = await transcribeAudio({ apiKey, audioPath });
    const meaningAnalysis = analyseMeaning(transcription.words);
    const producerDecision = createProducerDecision({
      goal: communicationGoal,
      transcript: transcription.text,
      meaningAnalysis,
      duration: tightenedMetadata.duration
    });

    const directorPlan = buildDirectorPlan({
      analyses: meaningAnalysis,
      videoDuration: tightenedMetadata.duration,
      maximumPunchIns: producerDecision.camera.maximumPunchIns,
      minimumSpacingSeconds: producerDecision.camera.minimumSpacingSeconds,
      punchDurationSeconds: producerDecision.camera.punchDurationSeconds,
      zoomScale: producerDecision.camera.zoomScale
    });

    await renderDirectorVideo({
      ffmpegPath,
      inputPath: tightenedPath,
      outputPath: directedPath,
      segments: directorPlan.segments,
      width: tightenedMetadata.width,
      height: tightenedMetadata.height
    });

    const captions = buildCaptionGroups(transcription.words, producerDecision.captions);
    if (!captions.length) throw new Error('ICA could not detect clear speech in this recording.');

    const visualPlan = buildVisualPlan({
      producerDecision,
      meaningAnalysis,
      transcript: transcription.text,
      duration: tightenedMetadata.duration,
      cameraDecisions: directorPlan.decisions
    });
    const soundCues = buildSoundCues(visualPlan);

    await Promise.all([
      fsp.writeFile(productionAssPath, createProductionAss({ captions, visuals: visualPlan, includeCaptions: true }), 'utf8'),
      fsp.writeFile(visualOnlyAssPath, createProductionAss({ captions, visuals: visualPlan, includeCaptions: false }), 'utf8')
    ]);

    await renderProductionVideo({
      ffmpegPath,
      inputPath: directedPath,
      subtitlePath: productionAssPath,
      outputPath,
      soundCues
    });

    const safeBaseName = sanitizeBaseName(req.file.originalname);
    outputRegistry.register({
      jobId,
      userId: req.auth.user.id,
      captionedPath: outputPath,
      directedPath,
      visualOnlyAssPath,
      soundCues,
      safeBaseName
    });
    preserveOutputArtifacts = true;

    await usageService.finish({ jobId, status: 'completed', outputCount: 1 }).catch(error => {
      console.error('ICA usage completion warning:', error?.code || error?.message || error);
    });
    const member = await usageService.getSummary(req.auth.user).catch(() => ({
      displayName: req.auth.user.user_metadata?.display_name || 'ICA Member',
      monthlyVideoAllowance: null,
      videosUsed: null,
      videosRemaining: claim.videosRemaining,
      periodStart: null,
      isActive: true,
      unlimited: Boolean(claim.unlimited)
    }));

    return {
      ok: true,
      jobId,
      outputUrl: `/api/media/${jobId}/captions`,
      noCaptionAvailable: true,
      detectedLanguage: transcription.language,
      captionCount: captions.length,
      visualCount: visualPlan.length,
      motionCount: visualPlan.filter(item => item.motion).length,
      soundCueCount: soundCues.length,
      usage: member,
      pauseRemoval: { secondsRemoved: pausePlan.totalRemovedSeconds },
      producer: {
        goal: producerDecision.goal,
        label: producerDecision.label,
        purpose: producerDecision.purpose
      },
      director: { punchIns: directorPlan.summary.punchIns }
    };
  } catch (error) {
    if (allowanceClaimed) {
      await usageService.finish({
        jobId,
        status: 'failed',
        outputCount: 0,
        errorCode: error.code || 'PRODUCTION_FAILED'
      }).catch(() => {});
    }
    await fsp.rm(outputPath, { force: true }).catch(() => {});
    throw error;
  } finally {
    await Promise.allSettled([
      fsp.rm(tightenedPath, { force: true }),
      fsp.rm(audioPath, { force: true }),
      fsp.rm(productionAssPath, { force: true }),
      preserveOutputArtifacts ? Promise.resolve() : fsp.rm(directedPath, { force: true }),
      preserveOutputArtifacts ? Promise.resolve() : fsp.rm(visualOnlyAssPath, { force: true })
    ]);
  }
}

function sanitizeBaseName(filename) {
  const stem = String(filename || 'ica-video').replace(/\.[^/.]+$/, '');
  const safe = stem.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return safe || 'ica-video';
}
