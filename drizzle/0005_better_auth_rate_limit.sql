CREATE TABLE IF NOT EXISTS "bauth"."rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "rate_limit_last_request_idx"
	ON "bauth"."rate_limit" ("last_request");
--> statement-breakpoint

ALTER TABLE "bauth"."rate_limit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "bauth"."rate_limit" FROM PUBLIC;
--> statement-breakpoint

DO $$
DECLARE
	client_role text;
BEGIN
	FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated']
	LOOP
		IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
			EXECUTE format('REVOKE ALL ON TABLE bauth.rate_limit FROM %I', client_role);
		END IF;
	END LOOP;
END $$;
