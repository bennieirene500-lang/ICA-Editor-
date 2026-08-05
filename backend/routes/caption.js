import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';

import express from 'express';
import multer from 'multer';

import { createStageTimer } from '../utils/stageTimer.js';
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
    const uploadReceivedAt = Date.now();

    if (!req.file || !inputPath) return res.status(400).json({ error: 'Please select a video first.' });

    console.log(
      `[ICA] upload received | file=${req.file.originalname} | bytes=${req.file.size} | mimetype=${req.file.mimetype}`
    );

    try {
      const result = await jobQueue.run(() => produceVideo({
        req,
        inputPath,
        uploadsDir,
        tempDir,
        outputsDir,
        ffmpegPath,
        usageService,
        outputRegistry,
        uploadReceivedAt
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

async function produceVideo({ req, inputPath, tempDir, outputsDir, ffmpegPath, usageService, outputRegistry, uploadReceivedAt }) {
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
  const timer = createStageTimer(jobId);
  if (uploadReceivedAt) {
    timer.mark(`queued for ${Date.now() - uploadReceivedAt}ms before job start`);
  }

  const tightenedPath = path.join(tempDir, `${jobId}-tightened.mp4`);
  const directedPath = path.join(tempDir, `${jobId}-directed.mp4`);
  const audioPath = path.join(tempDir, `${jobId}.mp3`);
  const productionAssPath = path.join(tempDir, `${jobId}-production.ass`);
  const visualOnlyAssPath = path.join(tempDir, `${jobId}-visual-only.ass`);
  const outputPath = path.join(outputsDir, `${jobId}-produced.mp4`);

  let allowanceClaimed = false;
  let preserveOutputArtifacts = false;

  try {
    const originalMetadata = await timer.stage('probeVideo (original)', () =>
      probeVideo({ ffmpegPath, inputPath })
    );

    const claim = await timer.stage('usageService.claim', () =>
      usageService.claim({
        user: req.auth.user,
        jobId,
        durationSeconds: originalMetadata.duration
      })
    );

    if (!claim.allowed) {
      const error = new Error('You have used the videos included for this month.');
      error.status = 403;
      error.code = 'VIDEO_ALLOWANCE_EXHAUSTED';
      error.videosRemaining = claim.videosRemaining;
      throw error;
    }
    allowanceClaimed = true;

    const silenceRanges = await timer.stage('detectSilence', () =>
      detectSilence({
        ffmpegPath,
        inputPath,
        noiseDb: -38,
        minimumSilenceSeconds: 0.85
      })
    );

    const pausePlan = await timer.stage('buildPausePlan', () =>
      buildPausePlan({
        silenceRanges,
        videoDuration: originalMetadata.duration,
        preserveSeconds: 0.28,
        minimumRemovalSeconds: 0.42,
        maximumSingleRemovalSeconds: 2.5
      })
    );

    await timer.stage('removePauses (ffmpeg pass 1/3)', () =>
      removePauses({
        ffmpegPath,
        inputPath,
        outputPath: tightenedPath,
        keepSegments: pausePlan.keepSegments
      })
    );

    const tightenedMetadata = await timer.stage('probeVideo (tightened)', () =>
      probeVideo({ ffmpegPath, inputPath: tightenedPath })
    );

    await timer.stage('extractAudio', () =>
      extractAudio({ ffmpegPath, inputPath: tightenedPath, audioPath })
    );

    const transcription = await timer.stage('transcribeAudio (OpenAI Whisper)', () =>
      transcribeAudio({ apiKey, audioPath })
    );

    const meaningAnalysis = await timer.stage('analyseMeaning', () =>
      analyseMeaning(transcription.words)
    );

    const producerDecision = await timer.stage('createProducerDecision', () =>
      createProducerDecision({
        goal: communicationGoal,
        transcript: transcription.text,
        meaningAnalysis,
        duration: tightenedMetadata.duration
      })
    );

    const directorPlan = await timer.stage('buildDirectorPlan', () =>
      buildDirectorPlan({
        analyses: meaningAnalysis,
        videoDuration: tightenedMetadata.duration,
        maximumPunchIns: producerDecision.camera.maximumPunchIns,
        minimumSpacingSeconds: producerDecision.camera.minimumSpacingSeconds,
        punchDurationSeconds: producerDecision.camera.punchDurationSeconds,
        zoomScale: producerDecision.camera.zoomScale
      })
    );

    await timer.stage('renderDirectorVideo (ffmpeg pass 2/3)', () =>
      renderDirectorVideo({
        ffmpegPath,
        inputPath: tightenedPath,
        outputPath: directedPath,
        segments: directorPlan.segments,
        width: tightenedMetadata.width,
        height: tightenedMetadata.height
      })
    );

    const captions = await timer.stage('buildCaptionGroups', () =>
      buildCaptionGroups(transcription.words, producerDecision.captions)
    );
    if (!captions.length) throw new Error('ICA could not detect clear speech in this recording.');

    const visualPlan = await timer.stage('buildVisualPlan', () =>
      buildVisualPlan({
        producerDecision,
        meaningAnalysis,
        transcript: transcription.text,
        duration: tightenedMetadata.duration,
        cameraDecisions: directorPlan.decisions
      })
    );

    const soundCues = await timer.stage('buildSoundCues', () => buildSoundCues(visualPlan));

    await timer.stage('write .ass subtitle files', () =>
      Promise.all([
        fsp.writeFile(productionAssPath, createProductionAss({ captions, visuals: visualPlan, includeCaptions: true }), 'utf8'),
        fsp.writeFile(visualOnlyAssPath, createProductionAss({ captions, visuals: visualPlan, includeCaptions: false }), 'utf8')
      ])
    );

    await timer.stage('renderProductionVideo (ffmpeg pass 3/3, subtitles+sound)', () =>
      renderProductionVideo({
        ffmpegPath,
        inputPath: directedPath,
        subtitlePath: productionAssPath,
        outputPath,
        soundCues
      })
    );

    const safeBaseName = sanitizeBaseName(req.file.originalname);
    await timer.stage('outputRegistry.register', () =>
      outputRegistry.register({
        jobId,
        userId: req.auth.user.id,
        captionedPath: outputPath,
        directedPath,
        visualOnlyAssPath,
        soundCues,
        safeBaseName
      })
    );
    preserveOutputArtifacts = true;

    await timer.stage('usageService.finish', () =>
      usageService.finish({ jobId, status: 'completed', outputCount: 1 }).catch(error => {
        console.error('ICA usage completion warning:', error?.code || error?.message || error);
      })
    );

    const member = await timer.stage('usageService.getSummary', () =>
      usageService.getSummary(req.auth.user).catch(() => ({
        displayName: req.auth.user.user_metadata?.display_name || 'ICA Member',
        monthlyVideoAllowance: null,
        videosUsed: null,
        videosRemaining: claim.videosRemaining,
        periodStart: null,
        isActive: true,
        unlimited: Boolean(claim.unlimited)
      }))
    );

    console.log(`[ICA][job=${jobId}] TOTAL JOB DURATION | totalMs=${timer.totalElapsedMs()}`);

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
    console.error(`[ICA][job=${jobId}] JOB FAILED | totalMs=${timer.totalElapsedMs()} | error=${error?.message || error}`);
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
