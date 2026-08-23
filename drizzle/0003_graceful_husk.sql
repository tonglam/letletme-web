CREATE TABLE "bauth"."mini_program_account" (
	"id" text PRIMARY KEY NOT NULL,
	"openid" text NOT NULL,
	"unionid" text,
	"linked_web_user_id" text,
	"linked_at" timestamp with time zone,
	"follow_entry_id" integer,
	"entry_choice" text,
	"entry_choice_mini_entry_id" integer,
	"entry_choice_web_entry_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mini_program_account_openid_unique" UNIQUE("openid"),
	CONSTRAINT "mini_program_account_follow_entry_positive" CHECK ("bauth"."mini_program_account"."follow_entry_id" is null or "bauth"."mini_program_account"."follow_entry_id" > 0),
	CONSTRAINT "mini_program_account_entry_choice_valid" CHECK ("bauth"."mini_program_account"."entry_choice" is null or "bauth"."mini_program_account"."entry_choice" in ('MINI', 'WEB')),
	CONSTRAINT "mini_program_account_entry_choice_pair_valid" CHECK (("bauth"."mini_program_account"."entry_choice" is null and "bauth"."mini_program_account"."entry_choice_mini_entry_id" is null and "bauth"."mini_program_account"."entry_choice_web_entry_id" is null) or ("bauth"."mini_program_account"."entry_choice" is not null and "bauth"."mini_program_account"."entry_choice_mini_entry_id" > 0 and "bauth"."mini_program_account"."entry_choice_web_entry_id" > 0 and "bauth"."mini_program_account"."entry_choice_mini_entry_id" <> "bauth"."mini_program_account"."entry_choice_web_entry_id"))
);
--> statement-breakpoint
DROP INDEX "bauth"."mini_program_session_active_user_device_unique";--> statement-breakpoint
ALTER TABLE "bauth"."mini_program_session" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bauth"."mini_program_session" ADD COLUMN "account_id" text;--> statement-breakpoint
ALTER TABLE "bauth"."mini_program_session" DROP CONSTRAINT "mini_program_session_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "bauth"."mini_program_session" ADD CONSTRAINT "mini_program_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "bauth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bauth"."mini_program_account" ADD CONSTRAINT "mini_program_account_linked_web_user_id_user_id_fk" FOREIGN KEY ("linked_web_user_id") REFERENCES "bauth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mini_program_account_unionid_unique" ON "bauth"."mini_program_account" USING btree ("unionid") WHERE "bauth"."mini_program_account"."unionid" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "mini_program_account_linked_web_user_unique" ON "bauth"."mini_program_account" USING btree ("linked_web_user_id") WHERE "bauth"."mini_program_account"."linked_web_user_id" is not null;--> statement-breakpoint
ALTER TABLE "bauth"."mini_program_session" ADD CONSTRAINT "mini_program_session_account_id_mini_program_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "bauth"."mini_program_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO bauth.mini_program_account (
	id,
	openid,
	linked_web_user_id,
	linked_at,
	created_at,
	updated_at
)
SELECT
	'legacy:' || u.id,
	u.openid,
	u.id,
	u.updated_at,
	u.created_at,
	u.updated_at
FROM bauth."user" u
WHERE u.openid IS NOT NULL
ON CONFLICT (openid) DO NOTHING;--> statement-breakpoint
UPDATE bauth.mini_program_session session
SET account_id = account.id
FROM bauth.mini_program_account account
WHERE session.account_id IS NULL
	AND session.user_id = account.linked_web_user_id;--> statement-breakpoint
CREATE UNIQUE INDEX "mini_program_session_active_account_device_unique" ON "bauth"."mini_program_session" USING btree ("account_id","device_id") WHERE "bauth"."mini_program_session"."revoked_at" is null and "bauth"."mini_program_session"."account_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "mini_program_session_active_user_device_unique" ON "bauth"."mini_program_session" USING btree ("user_id","device_id") WHERE "bauth"."mini_program_session"."revoked_at" is null and "bauth"."mini_program_session"."user_id" is not null;--> statement-breakpoint
ALTER TABLE "bauth"."mini_program_session" ADD CONSTRAINT "mini_program_session_principal_present" CHECK ("bauth"."mini_program_session"."user_id" is not null or "bauth"."mini_program_session"."account_id" is not null);--> statement-breakpoint
ALTER TABLE bauth.mini_program_account ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY web_auth_runtime_all
	ON bauth.mini_program_account
	TO letletme_web_auth
	USING (true)
	WITH CHECK (true);--> statement-breakpoint
CREATE POLICY graphql_auth_reader_select
	ON bauth.mini_program_account
	FOR SELECT
	TO letletme_graphql_reader
	USING (true);--> statement-breakpoint
GRANT SELECT, INSERT, DELETE, UPDATE
	ON TABLE bauth.mini_program_account
	TO letletme_web_auth;--> statement-breakpoint
GRANT SELECT(id, linked_web_user_id, follow_entry_id, entry_choice, entry_choice_mini_entry_id, entry_choice_web_entry_id)
	ON TABLE bauth.mini_program_account
	TO letletme_graphql_reader;--> statement-breakpoint
GRANT SELECT(account_id)
	ON TABLE bauth.mini_program_session
	TO letletme_graphql_reader;
