import path from 'node:path';
import express from 'express';

import { renderProductionVideo } from '../visuals/renderProductionVideo.js';

export function createMediaRouter({ requireUser, outputRegistry, jobQueue, outputsDir, ffmpegPath }) {
  const router = express.Router();

  router.get('/media/:jobId/:variant', requireUser, async (req, res, next) => {
    try {
      const entry = outputRegistry.get(req.params.jobId, req.auth.user.id);
      if (!entry) return res.status(404).json({ error: 'This video is no longer available. Please produce it again.' });

      const filePath = req.params.variant === 'no-captions'
        ? entry.noCaptionPath
        : entry.captionedPath;

      if (!filePath) {
        return res.status(404).json({
          error: 'The caption-free version has not been prepared yet.',
          code: 'NO_CAPTION_VERSION_NOT_READY'
        });
      }

      res.setHeader('Cache-Control', 'private, no-store');
      const download = req.query.download === '1';
      const suffix = req.params.variant === 'no-captions' ? '-without-captions.mp4' : '-ica-produced.mp4';
      const filename = `${entry.safeBaseName}${suffix}`;

      if (download) return res.download(filePath, filename);
      return res.sendFile(path.resolve(filePath));
    } catch (error) {
      next(error);
    }
  });

  router.post('/jobs/:jobId/no-captions', requireUser, async (req, res, next) => {
    try {
      const entry = outputRegistry.get(req.params.jobId, req.auth.user.id);
      if (!entry) return res.status(404).json({ error: 'This video is no longer available. Please produce it again.' });

      if (entry.noCaptionPath) {
        return res.json({ ok: true, url: `/api/media/${entry.jobId}/no-captions` });
      }

      if (!entry.noCaptionPromise) {
        const noCaptionPath = path.join(outputsDir, `${entry.jobId}-no-captions.mp4`);
        const promise = jobQueue.run(async () => {
          try {
            await renderProductionVideo({
              ffmpegPath,
              inputPath: entry.directedPath,
              subtitlePath: entry.cardOnlyAssPath,
              outputPath: noCaptionPath,
              soundCues: entry.soundCues,
              visualOverlays: entry.visualOverlays,
              width: entry.width,
              height: entry.height
            });
            outputRegistry.setNoCaptionPath(entry.jobId, noCaptionPath);
            return noCaptionPath;
          } catch (error) {
            const { rm } = await import('node:fs/promises');
            await rm(noCaptionPath, { force: true }).catch(() => {});
            outputRegistry.setNoCaptionPromise(entry.jobId, null);
            throw error;
          }
        });
        outputRegistry.setNoCaptionPromise(entry.jobId, promise);
      }

      const pendingRender = entry.noCaptionPromise;
      await pendingRender;
      return res.json({ ok: true, url: `/api/media/${entry.jobId}/no-captions` });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
