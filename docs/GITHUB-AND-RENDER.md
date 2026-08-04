# GitHub → Render deployment

## GitHub

1. Create a new private repository.
2. Upload the contents of this folder to the repository root. Do not upload the enclosing ZIP.
3. Confirm `.env` is not present.
4. Commit to the default branch.

## Render

1. Choose **New → Blueprint**.
2. Connect the GitHub repository.
3. Render reads `render.yaml` and builds the Docker image.
4. Add the three Supabase values and the OpenAI key when Render asks for unsynced environment variables.
5. Deploy.

Required secret values:

- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

No Render API key is required for this deployment.

## Successful deployment signal

Open `/api/health` on the Render service. It must return `ok: true` and show:

- `ffmpegReady: true`
- `openAiConfigured: true`
- `supabaseReady: true`

If the health check is not ready, Render logs will identify which connection is missing.

## Free beta behaviour

A free Render service may need time to wake after inactivity. Its filesystem is temporary, so finished videos expire and must be downloaded. This package also removes them automatically after the configured time.
