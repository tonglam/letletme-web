DO $$
BEGIN
	IF current_setting('server_version_num')::integer < 150000 THEN
		RAISE EXCEPTION 'LetLetMe web requires PostgreSQL 15 or newer (found %)', version();
	END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "bauth"."user" ADD COLUMN IF NOT EXISTS "openid" text;
ALTER TABLE "bauth"."user" ALTER COLUMN "name" DROP NOT NULL;
ALTER TABLE "bauth"."user" ALTER COLUMN "email" DROP NOT NULL;
--> statement-breakpoint

DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM "bauth"."user"
		WHERE "openid" IS NOT NULL
		GROUP BY "openid" HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'Duplicate non-null bauth.user.openid values require operator reconciliation';
	END IF;
END $$;
--> statement-breakpoint

DROP INDEX IF EXISTS "bauth"."idx_bauth_user_openid";
CREATE UNIQUE INDEX IF NOT EXISTS "user_openid_unique"
	ON "bauth"."user" ("openid") WHERE "openid" IS NOT NULL;
--> statement-breakpoint

WITH ranked AS (
	SELECT "id", row_number() OVER (
		PARTITION BY lower("email"), "device_id"
		ORDER BY "created_at" DESC, "id" DESC
	) AS rn
	FROM "bauth"."mini_program_email_code"
	WHERE "consumed_at" IS NULL
)
UPDATE "bauth"."mini_program_email_code" AS code
SET "consumed_at" = now()
FROM ranked WHERE code."id" = ranked."id" AND ranked.rn > 1;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "mini_program_email_code_pending_unique"
	ON "bauth"."mini_program_email_code" ("email", "device_id")
	WHERE "consumed_at" IS NULL;
--> statement-breakpoint

WITH ranked AS (
	SELECT "id", row_number() OVER (
		PARTITION BY "user_id", "device_id"
		ORDER BY "created_at" DESC, "id" DESC
	) AS rn
	FROM "bauth"."mini_program_session"
	WHERE "revoked_at" IS NULL
)
UPDATE "bauth"."mini_program_session" AS session
SET "revoked_at" = now()
FROM ranked WHERE session."id" = ranked."id" AND ranked.rn > 1;
--> statement-breakpoint

UPDATE "bauth"."mini_program_session"
SET "expires_at" = LEAST("expires_at", now() + interval '30 days')
WHERE "revoked_at" IS NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "mini_program_session_active_user_device_unique"
	ON "bauth"."mini_program_session" ("user_id", "device_id")
	WHERE "revoked_at" IS NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bauth"."request_rate_limits" (
	"scope" text NOT NULL,
	"subject" text NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"window_seconds" integer NOT NULL CHECK ("window_seconds" > 0),
	"count" integer NOT NULL CHECK ("count" > 0),
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "request_rate_limits_pk" PRIMARY KEY ("scope", "subject", "bucket_start")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "request_rate_limits_expires_idx"
	ON "bauth"."request_rate_limits" ("expires_at");
