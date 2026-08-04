# Milestone 10 validation report

## Completed in the build environment

- JavaScript syntax checks passed for all backend, frontend, script and test files.
- Milestone 9 visual-engine compatibility tests passed.
- Milestone 9 motion-engine compatibility tests passed.
- Milestone 10 session-cookie and sequential-queue tests passed.
- `render.yaml` parsed successfully as YAML.
- `index.html` parsed successfully.
- A real six-second FFmpeg render was completed with the golden test video, ICA captions and an ICA visual card.
- The rendered MP4 was verified with FFprobe.
- The package was scanned to exclude `.env`, `node_modules`, uploads, outputs, temporary files, Git history and ZIP files.

## Requires Nathan's live infrastructure

These checks cannot be completed without the private accounts and secrets and therefore remain part of the deployment test:

- Supabase migration execution
- Supabase user sign-in
- monthly allowance claim/refund against the live database
- OpenAI transcription using Nathan's private key
- Docker build on Render
- Render health check
- phone and desktop end-to-end testing

The package is ready for that deployment test, but it is not claimed as publicly production-approved until those live checks pass.
