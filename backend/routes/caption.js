import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';

import express from 'express';
import multer from 'multer';

import { createStageTimer } from '../utils/stageTimer.js';
import { safeErrorMessage, statusForError } from '../utils/errors.js';
import { detectSilence } from '../processor/detectSilence.js';
import { probeVideo } from '../processor/probeVideo.js';
import { buildPausePlan } from '../processor/buildPausePlan.js';
import { removePauses } from '../processor/removePauses.js';
import { extractAudio } from '../processor/extractAudio.js';
import { transcribeAudio } from '../processor/transcribeAudio.js';
import { analyseMeaning } from '../processor/analyseMeaning.js';
import { detectFillerSpans } from '../processor/detectFillerWords.js';
import { detectRestartedTakeSpans } from '../processor/detectRestartedTakes.js';
import { buildDirectorPlan } from '../processor/buildDirectorPlan.js';
import { renderDirectorVideo } from '../processor/renderDirectorVideo.js';
import { detectFaceTrack, buildReframePlan } from '../processor/buildReframePlan.js';
import { buildCaptionGroups } from '../processor/buildCaptions.js';
import { applyCaptionEmphasis } from '../processor/applyCaptionEmphasis.js';
import { createProducerDecision } from '../producer/producerBrain.js';
import { analyzeMoments } from '../producer/analyzeMoments.js';
import { generateVisualImages } from '../visuals/generateVisualImages.js';
import { fetchStockMedia } from '../visuals/fetchStockMedia.js';
import { buildVisualPlan } from '../visuals/buildVisualPlan.js';
import { pickPalette } from '../visuals/paletteLibrary.js';
import { createProductionAss } from '../visuals/createProductionAss.js';
import { renderProductionVideo } from '../visuals/renderProductionVideo.js';
import { buildSoundCues } from '../visuals/motionLibrary.js';

const MAX_VIDEO_DURATION_SECONDS = 60;

export function createCaptionRouter({
  uploadsDir,
  tempDir,
  outputsDir,
  ffmpegPath,
  maxFileBytes,
  requireUser,
  usageService,
  jobQueue,
  outputRegistry,
  visionPythonPath,
  faceTrackScriptPath,
  faceTrackReady
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

  router.post('/caption-video', requireUser, upload.single('video'), async (req, res) => {
    const inputPath = req.file?.path;
    const uploadReceivedAt = Date.now();

    if (!req.file || !inputPath) return res.status(400).json({ error: 'Please select a video first.' });

    console.log(
      `[ICA] upload received | file=${req.file.originalname} | bytes=${req.file.size} | mimetype=${req.file.mimetype}`
    );

    // Stream the response as SSE so the connection keeps transferring data
    // for the full duration of the render (some hosts close idle HTTP
    // connections after a fixed window if no bytes are sent). The business
    // logic in produceVideo() below is completely unchanged — only the
    // transport used to deliver its result/error is different.
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();

    // Response-side disconnect signal, not the request object: req can
    // legitimately emit 'close' once the upload finishes even though the
    // client is still waiting on the response, which would mark us
    // "disconnected" while the render is still in progress.
    let closed = false;
    res.on('close', () => {
      if (!res.writableEnded) closed = true;
    });

    const send = (event, payload) => {
      if (closed) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    let heartbeat;

    try {
      heartbeat = setInterval(() => send('heartbeat', { at: Date.now() }), 20_000);

      const result = await jobQueue.run(() => produceVideo({
        req,
        inputPath,
        uploadsDir,
        tempDir,
        outputsDir,
        ffmpegPath,
        usageService,
        outputRegistry,
        uploadReceivedAt,
        visionPythonPath,
        faceTrackScriptPath,
        faceTrackReady
      }));

      send('result', result);
    } catch (error) {
      // Same logging + same error shape the generic Express error handler
      // used to produce via next(error). The one unavoidable difference:
      // the transport-level HTTP status is always 200 once streaming has
      // started, so the real status now travels inside the payload and the
      // frontend reads error.status from there instead of response.status.
      console.error('ICA server error:', error?.code || error?.message || error);
      send('error', {
        error: safeErrorMessage(error),
        code: error?.code || 'ICA_PRODUCTION_ERROR',
        status: statusForError(error),
        ...(Number.isFinite(error?.videosRemaining) ? { videosRemaining: error.videosRemaining } : {})
      });
    } finally {
      clearInterval(heartbeat);
      await fsp.rm(inputPath, { force: true }).catch(() => {});
      if (!closed) res.end();
    }
  });

  return router;
}

async function produceVideo({ req, inputPath, tempDir, outputsDir, ffmpegPath, usageService, outputRegistry, uploadReceivedAt, visionPythonPath, faceTrackScriptPath, faceTrackReady }) {
  const communicationGoal = String(req.body?.communicationGoal || '').trim().toLowerCase();
  if (!communicationGoal) {
    const error = new Error('Tell ICA what you want this video to achieve.');
    error.status = 400;
    throw error;
  }

  const roughCutIntensity = ['light', 'balanced', 'tight'].includes(
    String(req.body?.roughCutIntensity || '').trim().toLowerCase()
  ) ? req.body.roughCutIntensity.trim().toLowerCase() : 'balanced';

  const includeMusic = String(req.body?.includeMusic ?? 'true').trim().toLowerCase() !== 'false';
  const includeReframe = String(req.body?.includeReframe ?? 'true').trim().toLowerCase() !== 'false';

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
  const cleanedPath = path.join(tempDir, `${jobId}-cleaned.mp4`);
  const directedPath = path.join(tempDir, `${jobId}-directed.mp4`);
  const audioPath = path.join(tempDir, `${jobId}.mp3`);
  const productionAssPath = path.join(tempDir, `${jobId}-production.ass`);
  const cardOnlyAssPath = path.join(tempDir, `${jobId}-cards-only.ass`);
  const outputPath = path.join(outputsDir, `${jobId}-produced.mp4`);

  let allowanceClaimed = false;
  let preserveOutputArtifacts = false;
  let generatedImagePaths = [];
  let cleanedPathCreated = false;

  try {
    const originalMetadata = await timer.stage('probeVideo (original)', () =>
      probeVideo({ ffmpegPath, inputPath })
    );

    if (originalMetadata.duration > MAX_VIDEO_DURATION_SECONDS) {
      const error = new Error(
        `ICA can only produce videos up to ${MAX_VIDEO_DURATION_SECONDS} seconds long. This recording is ${Math.round(originalMetadata.duration)}s — trim it and try again.`
      );
      error.status = 400;
      error.code = 'VIDEO_TOO_LONG';
      throw error;
    }

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

    const firstPassAnalysis = await timer.stage('analyseMeaning', () =>
      analyseMeaning(transcription.words)
    );

    const roughCutExtras = await timer.stage('detect filler words + restarted takes', () => {
      if (roughCutIntensity === 'light') return [];

      const spans = [...detectFillerSpans(transcription.words)];

      if (roughCutIntensity === 'tight') {
        spans.push(...detectRestartedTakeSpans(firstPassAnalysis, {
          maxGapSeconds: 3.5,
          similarityThreshold: 0.5
        }));
      }

      return spans;
    });

    let finalPath = tightenedPath;
    let finalMetadata = tightenedMetadata;
    let finalWords = transcription.words;
    let meaningAnalysis = firstPassAnalysis;

    if (roughCutExtras.length) {
      const extraPlan = buildPausePlan({
        silenceRanges: [],
        videoDuration: tightenedMetadata.duration,
        extraRemovals: roughCutExtras
      });

      if (extraPlan.removals.length) {
        await timer.stage('removePauses (ffmpeg pass — fillers/restarts)', () =>
          removePauses({
            ffmpegPath,
            inputPath: tightenedPath,
            outputPath: cleanedPath,
            keepSegments: extraPlan.keepSegments
          })
        );
        cleanedPathCreated = true;

        finalMetadata = await timer.stage('probeVideo (cleaned)', () =>
          probeVideo({ ffmpegPath, inputPath: cleanedPath })
        );
        finalPath = cleanedPath;

        const remapTime = buildTimeRemapper(extraPlan.removals);
        finalWords = transcription.words
          .filter(word => !isInsideAnyRemoval((Number(word.start) + Number(word.end)) / 2, extraPlan.removals))
          .map(word => ({
            word: word.word,
            start: remapTime(Number(word.start)),
            end: remapTime(Number(word.end))
          }));

        meaningAnalysis = analyseMeaning(finalWords);
      }
    }

    const producerDecision = await timer.stage('createProducerDecision', () =>
      createProducerDecision({ goal: communicationGoal })
    );

    const directorPlan = await timer.stage('buildDirectorPlan', () =>
      buildDirectorPlan({
        analyses: meaningAnalysis,
        videoDuration: finalMetadata.duration,
        maximumPunchIns: producerDecision.camera.maximumPunchIns,
        minimumSpacingSeconds: producerDecision.camera.minimumSpacingSeconds,
        punchDurationSeconds: producerDecision.camera.punchDurationSeconds,
        zoomScale: producerDecision.camera.zoomScale
      })
    );

    await timer.stage('renderDirectorVideo (ffmpeg pass 2/3)', () =>
      renderDirectorVideo({
        ffmpegPath,
        inputPath: finalPath,
        outputPath: directedPath,
        segments: directorPlan.segments,
        width: finalMetadata.width,
        height: finalMetadata.height
      })
    );

    const [{ moments, emphasisWords }, reframePlan] = await Promise.all([
      timer.stage('analyzeMoments (OpenAI, real understanding)', () =>
        analyzeMoments({
          apiKey,
          words: finalWords,
          goal: communicationGoal,
          duration: finalMetadata.duration
        })
      ),
      timer.stage('detectFaceTrack + buildReframePlan (auto-reframe)', async () => {
        if (!faceTrackReady || !includeReframe) return null;
        try {
          const detection = await detectFaceTrack({
            pythonPath: visionPythonPath,
            scriptPath: faceTrackScriptPath,
            videoPath: directedPath
          });
          return buildReframePlan({
            sourceWidth: detection.sourceWidth,
            sourceHeight: detection.sourceHeight,
            track: detection.track
          });
        } catch {
          return null;
        }
      })
    ]);

    const palette = pickPalette(jobId);

    const rawTemplateMoments = moments.filter(moment => moment.tier === 'template');
    const stockMoments = moments.filter(moment => moment.tier === 'stock');
    const generatedMoments = moments.filter(moment => moment.tier === 'generated');

    const pexelsApiKey = process.env.PEXELS_API_KEY?.trim();

    const indexedTemplateMoments = rawTemplateMoments.map((moment, index) => ({ ...moment, _templateIndex: index }));

    const [templateBackdrops, fetchedStockMoments, imagedMoments] = await Promise.all([
      timer.stage('fetchStockMedia (card backdrops, one per card)', () => (
        pexelsApiKey && indexedTemplateMoments.length
          ? fetchStockMedia({
              apiKey: pexelsApiKey,
              moments: indexedTemplateMoments,
              tempDir,
              jobId: `${jobId}-backdrop`,
              photoOnly: true
            })
          : []
      )),
      timer.stage('fetchStockMedia (Pexels)', () => (
        pexelsApiKey && stockMoments.length
          ? fetchStockMedia({ apiKey: pexelsApiKey, moments: stockMoments, tempDir, jobId })
          : []
      )),
      timer.stage('generateVisualImages (OpenAI image generation)', () => (
        generatedMoments.length
          ? generateVisualImages({ apiKey, moments: generatedMoments, tempDir, jobId })
          : []
      ))
    ]);

    const backdropByIndex = new Map(templateBackdrops.map(item => [item._templateIndex, item.mediaPath]));

    const templateMoments = rawTemplateMoments.map((moment, index) => ({
      ...moment,
      palette,
      backdropImagePath: backdropByIndex.get(index) || null,
      backdropColorSource: palette.backdropColorSource
    }));

    generatedImagePaths = [
      ...templateBackdrops.map(item => item.mediaPath),
      ...fetchedStockMoments.map(moment => moment.mediaPath),
      ...imagedMoments.map(moment => moment.imagePath)
    ];

    const visualPlan = await timer.stage('buildVisualPlan', () =>
      buildVisualPlan({
        moments: [...templateMoments, ...fetchedStockMoments, ...imagedMoments],
        duration: finalMetadata.duration,
        goal: communicationGoal
      })
    );

    const cardVisuals = visualPlan.filter(visual => visual.kind === 'color');

    const captions = await timer.stage('buildCaptionGroups (captions clear during cutaways)', () => {
      const captionWords = finalWords.filter(word => (
        !visualPlan.some(visual => {
          const midpoint = (Number(word.start) + Number(word.end)) / 2;
          return midpoint >= visual.start && midpoint < visual.end;
        })
      ));
      return buildCaptionGroups(captionWords, producerDecision.captions);
    });
    if (!captions.length) throw new Error('ICA could not detect clear speech in this recording.');

    const emphasizedCaptions = applyCaptionEmphasis(captions, emphasisWords);

    const soundCues = await timer.stage('buildSoundCues', () => buildSoundCues(visualPlan));

    await timer.stage('write .ass caption+card files', () =>
      Promise.all([
        fsp.writeFile(productionAssPath, createProductionAss({ captions: emphasizedCaptions, cards: cardVisuals }), 'utf8'),
        fsp.writeFile(cardOnlyAssPath, createProductionAss({ captions: [], cards: cardVisuals }), 'utf8')
      ])
    );

    await timer.stage('renderProductionVideo (ffmpeg pass 3/3, cutaways+captions+sound)', () =>
      renderProductionVideo({
        ffmpegPath,
        inputPath: directedPath,
        subtitlePath: productionAssPath,
        outputPath,
        soundCues,
        visualOverlays: visualPlan,
        width: finalMetadata.width,
        height: finalMetadata.height,
        reframe: reframePlan,
        withMusic: includeMusic
      })
    );

    const safeBaseName = sanitizeBaseName(req.file.originalname);
    await timer.stage('outputRegistry.register', () =>
      outputRegistry.register({
        jobId,
        userId: req.auth.user.id,
        captionedPath: outputPath,
        directedPath,
        cardOnlyAssPath,
        visualOverlays: visualPlan,
        width: finalMetadata.width,
        height: finalMetadata.height,
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
      cleanedPathCreated ? fsp.rm(cleanedPath, { force: true }) : Promise.resolve(),
      fsp.rm(audioPath, { force: true }),
      fsp.rm(productionAssPath, { force: true }),
      preserveOutputArtifacts ? Promise.resolve() : fsp.rm(directedPath, { force: true }),
      preserveOutputArtifacts ? Promise.resolve() : fsp.rm(cardOnlyAssPath, { force: true }),
      ...(preserveOutputArtifacts ? [] : generatedImagePaths.map(imagePath => fsp.rm(imagePath, { force: true })))
    ]);
  }
}

function buildTimeRemapper(removals) {
  const sorted = [...removals].sort((a, b) => a.start - b.start);
  return (time) => {
    let shift = 0;
    for (const removal of sorted) {
      if (removal.end <= time) shift += (removal.end - removal.start);
    }
    return Math.max(0, time - shift);
  };
}

function isInsideAnyRemoval(time, removals) {
  return removals.some(removal => time >= removal.start && time < removal.end);
}

function sanitizeBaseName(filename) {
  const stem = String(filename || 'ica-video').replace(/\.[^/.]+$/, '');
  const safe = stem.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return safe || 'ica-video';
}
