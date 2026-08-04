# Environment variables

## Secrets

`OPENAI_API_KEY` — OpenAI project API key used only by the backend.

`SUPABASE_URL` — Supabase project URL.

`SUPABASE_PUBLISHABLE_KEY` — Supabase low-privilege application key used by the backend auth proxy.

`SUPABASE_SECRET_KEY` — Supabase backend-only elevated key. Never expose it in the browser or repository.

## Configuration

`ICA_AUTH_MODE=required` — blocks the app until a member signs in.

`MAX_CONCURRENT_JOBS=1` — protects the first beta service from overlapping FFmpeg renders.

`MAX_PENDING_JOBS=5` — maximum waiting requests.

`OUTPUT_TTL_MINUTES=45` — automatic deletion window for final and intermediate videos.

`MAX_UPLOAD_MB=500` — upload guardrail.

`FFMPEG_PATH=/usr/bin/ffmpeg` — provided by the Docker image.

`DEFAULT_BETA_VIDEO_ALLOWANCE=5` — documentation/default value. The live allowance is stored per member in Supabase.
