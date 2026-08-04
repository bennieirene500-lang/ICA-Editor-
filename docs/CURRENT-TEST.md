# Milestone 10 Current Test

This milestone tests the real GitHub → Render → Supabase → OpenAI path while preserving the approved ICA member experience.

## Test order

1. Run the Supabase migration.
2. Create Nathan's private beta user.
3. Push the clean repository to GitHub.
4. Deploy the Render Blueprint.
5. Confirm `/api/health` returns `ok: true`.
6. Sign in from the Render URL.
7. Produce the golden test video.
8. Preview and download the captioned version.
9. Prepare and download the caption-free version.
10. Confirm only one monthly video is used.

## Approval questions

- Does the frontend communicate with the hosted backend?
- Does Supabase protect access and show the correct videos remaining?
- Does Render complete FFmpeg production and return the final video?
- Is the member flow still effortless?
- Do failures return the member's video allowance?
