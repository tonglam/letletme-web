-- Pre-migration: ensure the dedicated `bauth` schema exists before
-- drizzle-kit applies the Better Auth tables. Safe to re-run.
-- NOTE: Supabase owns the `auth` schema; we use `bauth` instead.
CREATE SCHEMA IF NOT EXISTS bauth;
