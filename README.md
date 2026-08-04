# ICA AI Producer — Milestone 10 Beta Foundation

This repository is the clean GitHub → Render package for founder testing and five trusted beta members.

## Locked member flow

Sign in → Add video → Produce → Choose outcome → Preview → Download

No editing timeline and no technical production decisions are exposed to the member.

## Included

- The complete approved Milestone 9 Producer Brain, captions, pacing, camera direction, kinetic visuals and restrained sound accents
- One Render web service for the frontend, backend and FFmpeg processing
- Docker-based FFmpeg runtime
- Supabase email/password authentication through secure HTTP-only cookies
- Monthly “videos remaining” allowance tracking
- Atomic usage claims with automatic refunds when production fails
- One active render at a time with a small beta queue
- Private, user-bound preview and download routes
- Caption-free rendering only when requested, with no second OpenAI transcription
- Automatic deletion of temporary video files after 45 minutes
- Render Blueprint, Dockerfile, Supabase SQL migration, environment checklist and beta test plan

## Important beta boundary

Render’s local filesystem is used only as temporary working space. Members must download completed videos before they expire. Permanent object storage is intentionally deferred until the pipeline has been validated with the beta group.

## First deployment

Read these files in order:

1. `docs/SUPABASE-SETUP.md`
2. `docs/GITHUB-AND-RENDER.md`
3. `docs/BETA-TEST-CHECKLIST.md`

Never commit `.env` or paste secret keys into source code.
