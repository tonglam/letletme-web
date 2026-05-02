CREATE TABLE IF NOT EXISTS "bauth"."mini_program_email_code" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"device_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "bauth"."mini_program_session" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" text NOT NULL,
	"device_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "mini_program_session_token_hash_idx"
	ON "bauth"."mini_program_session" USING btree ("token_hash");

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'mini_program_session_user_id_user_id_fk'
	) THEN
		ALTER TABLE "bauth"."mini_program_session"
			ADD CONSTRAINT "mini_program_session_user_id_user_id_fk"
			FOREIGN KEY ("user_id") REFERENCES "bauth"."user"("id")
			ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
