-- Persistent throttle marker for the lazy FPL identity refresh: the profile
-- page schedules a re-sync only when this timestamp is missing or older than
-- 24h, so the once-per-day limit survives serverless cold starts (unlike an
-- in-process map).
ALTER TABLE "bauth"."user"
	ADD COLUMN IF NOT EXISTS "fpl_identity_refreshed_at" timestamptz;
