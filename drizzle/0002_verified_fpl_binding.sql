ALTER TABLE "bauth"."user"
	ADD COLUMN IF NOT EXISTS "fpl_entry_verified_at" timestamp with time zone;
--> statement-breakpoint

-- Every existing binding deliberately remains unverified until its owner
-- completes the team-name challenge.
CREATE UNIQUE INDEX IF NOT EXISTS "user_verified_fpl_entry_unique"
	ON "bauth"."user" ("fpl_entry_id")
	WHERE "fpl_entry_verified_at" IS NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bauth"."fpl_entry_binding_challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"entry_id" integer NOT NULL,
	"required_name" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'fpl_entry_binding_challenges_user_id_user_id_fk'
			AND conrelid = 'bauth.fpl_entry_binding_challenges'::regclass
	) THEN
		ALTER TABLE "bauth"."fpl_entry_binding_challenges"
			ADD CONSTRAINT "fpl_entry_binding_challenges_user_id_user_id_fk"
			FOREIGN KEY ("user_id") REFERENCES "bauth"."user"("id")
			ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "fpl_entry_binding_challenges_user_created_idx"
	ON "bauth"."fpl_entry_binding_challenges" ("user_id", "created_at");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "fpl_entry_binding_challenges_pending_idx"
	ON "bauth"."fpl_entry_binding_challenges" ("user_id", "expires_at")
	WHERE "consumed_at" IS NULL;
