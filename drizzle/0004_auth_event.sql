CREATE TABLE "bauth"."auth_event" (
	"id" text PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"request_id" text NOT NULL,
	"event_type" text NOT NULL,
	"channel" text NOT NULL,
	"operation" text NOT NULL,
	"outcome" text NOT NULL,
	"status_code" integer,
	"error_code" text,
	"phase_timings" jsonb,
	"web_user_ref" text,
	"mini_account_ref" text,
	"email_ref" text,
	"session_ref" text,
	"device_ref" text,
	"ip_ref" text,
	"trigger" text,
	"revoked_session_count" integer,
	"client_platform" text,
	"client_device_class" text,
	"client_os_family" text,
	"client_os_major" text,
	"client_browser_family" text,
	"client_browser_major" text,
	"wechat_major" text,
	"sdk_version" text,
	"mini_program_version" text,
	"env_version" text,
	"page_route" text,
	"encrypted_storage_supported" boolean,
	"credential_state" text,
	"release" text,
	"source" text,
	"region" text
);
--> statement-breakpoint
CREATE INDEX "auth_event_expires_idx" ON "bauth"."auth_event" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_event_request_idx" ON "bauth"."auth_event" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "auth_event_session_idx" ON "bauth"."auth_event" USING btree ("session_ref");--> statement-breakpoint
CREATE INDEX "auth_event_web_user_idx" ON "bauth"."auth_event" USING btree ("web_user_ref");--> statement-breakpoint
CREATE INDEX "auth_event_mini_account_idx" ON "bauth"."auth_event" USING btree ("mini_account_ref");--> statement-breakpoint
CREATE INDEX "auth_event_device_idx" ON "bauth"."auth_event" USING btree ("device_ref");--> statement-breakpoint
CREATE INDEX "auth_event_occurred_idx" ON "bauth"."auth_event" USING btree ("occurred_at");--> statement-breakpoint
ALTER TABLE bauth.auth_event
    ADD CONSTRAINT auth_event_expiry_window_check
    CHECK (
        expires_at >= occurred_at
        AND expires_at <= occurred_at + INTERVAL '45 days'
    );--> statement-breakpoint
ALTER TABLE bauth.auth_event ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY web_auth_event_select
    ON bauth.auth_event
    FOR SELECT
    TO letletme_web_auth
    USING (true);--> statement-breakpoint
CREATE POLICY web_auth_event_insert
    ON bauth.auth_event
    FOR INSERT
    TO letletme_web_auth
    WITH CHECK (
        expires_at >= occurred_at
        AND expires_at <= occurred_at + INTERVAL '45 days'
    );--> statement-breakpoint
CREATE POLICY web_auth_event_delete_expired
    ON bauth.auth_event
    FOR DELETE
    TO letletme_web_auth
    USING (expires_at <= CURRENT_TIMESTAMP);--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE bauth.auth_event TO letletme_web_auth;
