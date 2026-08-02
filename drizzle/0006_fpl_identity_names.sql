-- Bind-time identity snapshot: team and manager name captured from the FPL
-- API when the entry is linked, so profile surfaces never re-hit FPL.
ALTER TABLE "bauth"."user"
	ADD COLUMN IF NOT EXISTS "fpl_team_name" text;
--> statement-breakpoint

ALTER TABLE "bauth"."user"
	ADD COLUMN IF NOT EXISTS "fpl_manager_name" text;
