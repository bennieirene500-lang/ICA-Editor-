function integerFromEnvironment(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(raw)));
}

export function createRuntimeConfig() {
  const production = process.env.NODE_ENV === 'production';
  const authMode = String(
    process.env.ICA_AUTH_MODE || (production ? 'required' : 'optional')
  ).trim().toLowerCase();

  if (!['required', 'optional', 'disabled'].includes(authMode)) {
    throw new Error('ICA_AUTH_MODE must be required, optional, or disabled.');
  }

  const supabase = {
    url: String(process.env.SUPABASE_URL || '').replace(/\/$/, ''),
    publishableKey: String(process.env.SUPABASE_PUBLISHABLE_KEY || ''),
    secretKey: String(process.env.SUPABASE_SECRET_KEY || '')
  };

  const supabaseConfigured = Boolean(
    supabase.url && supabase.publishableKey && supabase.secretKey
  );

  if (authMode === 'required' && !supabaseConfigured) {
    throw new Error(
      'Supabase is required but SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, or SUPABASE_SECRET_KEY is missing.'
    );
  }

  return Object.freeze({
    production,
    authMode,
    supabase,
    supabaseConfigured,
    port: integerFromEnvironment('PORT', 3000, { min: 1, max: 65535 }),
    ffmpegPath: String(process.env.FFMPEG_PATH || 'ffmpeg'),
    openAiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    maxUploadBytes: integerFromEnvironment('MAX_UPLOAD_MB', 500, { min: 10, max: 1000 }) * 1024 * 1024,
    outputTtlMs: integerFromEnvironment('OUTPUT_TTL_MINUTES', 45, { min: 10, max: 180 }) * 60 * 1000,
    maxConcurrentJobs: integerFromEnvironment('MAX_CONCURRENT_JOBS', 1, { min: 1, max: 4 }),
    maxPendingJobs: integerFromEnvironment('MAX_PENDING_JOBS', 5, { min: 1, max: 50 }),
    defaultBetaVideoAllowance: integerFromEnvironment('DEFAULT_BETA_VIDEO_ALLOWANCE', 5, { min: 1, max: 100 })
  });
}
