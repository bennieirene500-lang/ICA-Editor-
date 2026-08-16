import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import dotenv from 'dotenv';
import express from 'express';

import { createRuntimeConfig } from './config.js';
import { SupabaseGateway } from './auth/supabaseGateway.js';
import { createSessionManager } from './auth/session.js';
import { UsageService } from './usage/usageService.js';
import { JobQueue } from './jobs/jobQueue.js';
import { OutputRegistry } from './jobs/outputRegistry.js';
import { createAuthRouter } from './routes/auth.js';
import { createMemberRouter } from './routes/member.js';
import { createCaptionRouter } from './routes/caption.js';
import { createMediaRouter } from './routes/media.js';
import { safeErrorMessage, statusForError } from './utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const backendDir = path.dirname(__filename);
const projectDir = path.resolve(backendDir, '..');
dotenv.config({ path: path.join(projectDir, '.env') });

const config = createRuntimeConfig();
const runtimeRoot = process.env.ICA_RUNTIME_DIR || (
  config.production ? path.join(os.tmpdir(), 'ica-ai-producer') : projectDir
);
const uploadsDir = path.join(runtimeRoot, 'uploads');
const tempDir = path.join(runtimeRoot, 'temp');
const outputsDir = path.join(runtimeRoot, 'outputs');
await Promise.all([uploadsDir, tempDir, outputsDir].map(dir => fsp.mkdir(dir, { recursive: true })));

const ffmpegReady = spawnSync(config.ffmpegPath, ['-version'], { stdio: 'ignore' }).status === 0;
const visionPythonPath = process.env.FACE_TRACK_PYTHON || path.join(projectDir, '.venv-vision', 'bin', 'python3');
const faceTrackScriptPath = path.join(backendDir, 'vision', 'detectFaceTrack.py');
const faceTrackReady = spawnSync(visionPythonPath, ['-c', 'import cv2'], { stdio: 'ignore' }).status === 0;
const gateway = new SupabaseGateway(config.supabase);
const sessionManager = createSessionManager({
  gateway,
  authMode: config.authMode,
  production: config.production
});
const usageService = new UsageService({
  gateway,
  enabled: sessionManager.authEnabled,
  defaultAllowance: config.defaultBetaVideoAllowance
});
const jobQueue = new JobQueue({
  maxConcurrent: config.maxConcurrentJobs,
  maxPending: config.maxPendingJobs
});
const outputRegistry = new OutputRegistry({ ttlMs: config.outputTtlMs });

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  next();
});
app.use(express.json({ limit: '64kb' }));

app.get('/api/config', (_req, res) => {
  res.json({
    appName: 'ICA AI Producer',
    authEnabled: sessionManager.authEnabled,
    beta: true,
    maxUploadMb: Math.round(config.maxUploadBytes / 1024 / 1024),
    outputAvailabilityMinutes: Math.round(config.outputTtlMs / 60000)
  });
});

app.get('/api/health', async (_req, res) => {
  const baseReady = ffmpegReady && config.openAiConfigured;
  let supabaseReady = !sessionManager.authEnabled;
  if (sessionManager.authEnabled) {
    try { supabaseReady = await gateway.ping(); }
    catch { supabaseReady = false; }
  }
  const ready = baseReady && supabaseReady;
  res.status(ready ? 200 : 503).json({
    ok: ready,
    service: 'ica-ai-producer-beta',
    ffmpegReady,
    openAiConfigured: config.openAiConfigured,
    authMode: config.authMode,
    supabaseConfigured: gateway.configured,
    supabaseReady,
    queue: jobQueue.state
  });
});

app.use('/api', createAuthRouter({ gateway, sessionManager, usageService }));
app.use('/api', createMemberRouter({ requireUser: sessionManager.requireUser, usageService }));
app.use('/api', createCaptionRouter({
  uploadsDir,
  tempDir,
  outputsDir,
  ffmpegPath: config.ffmpegPath,
  maxFileBytes: config.maxUploadBytes,
  requireUser: sessionManager.requireUser,
  usageService,
  jobQueue,
  outputRegistry,
  visionPythonPath,
  faceTrackScriptPath,
  faceTrackReady
}));
app.use('/api', createMediaRouter({
  requireUser: sessionManager.requireUser,
  outputRegistry,
  jobQueue,
  outputsDir,
  ffmpegPath: config.ffmpegPath
}));

app.use(express.static(projectDir, {
  extensions: ['html'],
  index: 'index.html',
  dotfiles: 'deny',
  maxAge: config.production ? '1h' : 0
}));

app.use((error, _req, res, _next) => {
  console.error('ICA server error:', error?.code || error?.message || error);
  res.status(statusForError(error)).json({
    error: safeErrorMessage(error),
    code: error?.code || 'ICA_PRODUCTION_ERROR',
    ...(Number.isFinite(error?.videosRemaining) ? { videosRemaining: error.videosRemaining } : {})
  });
});

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log('');
  console.log('ICA AI Producer — Milestone 10 Beta Foundation');
  console.log('-----------------------------------------------');
  console.log(`Listening on: 0.0.0.0:${config.port}`);
  console.log(`Environment: ${config.production ? 'production' : 'development'}`);
  console.log(`Authentication: ${sessionManager.authEnabled ? 'Supabase required' : 'founder preview'}`);
  console.log(`OpenAI configured: ${config.openAiConfigured ? 'Yes' : 'No'}`);
  console.log(`FFmpeg ready: ${ffmpegReady ? 'Yes' : 'No'}`);
  console.log(`Face tracking ready: ${faceTrackReady ? 'Yes' : 'No (auto-reframe will be skipped)'}`);
  console.log(`Temporary outputs expire after: ${Math.round(config.outputTtlMs / 60000)} minutes`);
  console.log('');
});

server.requestTimeout = 60 * 60 * 1000;
server.headersTimeout = 65 * 1000;
server.keepAliveTimeout = 120 * 1000;

async function shutdown(signal) {
  console.log(`Received ${signal}. Finishing shutdown.`);
  server.close(async () => {
    await outputRegistry.dispose();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 290000).unref();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
