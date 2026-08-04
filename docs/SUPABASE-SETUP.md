# Supabase setup — one time

## 1. Run the ICA migration

Open the Supabase SQL Editor, create a new query, paste the complete contents of:

`supabase/migrations/001_ica_beta_foundation.sql`

Run it once.

This creates:

- `ica_member_profiles`
- `ica_usage_events`
- the automatic profile trigger
- the monthly allowance functions
- failed-job refunds
- Row Level Security with no direct browser access

## 2. Create beta members

In Authentication → Users, create Nathan’s account first and then up to five trusted beta accounts. Use confirmed email/password accounts for this test.

The database trigger automatically gives every new member five videos for the current month.

## 3. Change an allowance

In Table Editor → `ica_member_profiles`, change `monthly_video_allowance` for a specific member. Do not edit `videos_used` during normal testing unless correcting a test mistake.

## 4. Copy three values for Render

From the Supabase project settings, copy:

- Project URL → `SUPABASE_URL`
- Publishable key → `SUPABASE_PUBLISHABLE_KEY`
- Secret key (or legacy service-role key) → `SUPABASE_SECRET_KEY`

The secret key belongs only in Render environment variables. Never put it in GitHub or browser code.
