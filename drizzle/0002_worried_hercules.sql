CREATE TABLE "bauth"."fpl_entry_name_history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"entry_id" integer NOT NULL,
	"team_name" text NOT NULL,
	"manager_name" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fpl_entry_name_history_user_entry_name_unique" UNIQUE("user_id","entry_id","team_name"),
	CONSTRAINT "fpl_entry_name_history_team_name_nonempty" CHECK (btrim("bauth"."fpl_entry_name_history"."team_name") <> '')
);
--> statement-breakpoint
ALTER TABLE "bauth"."fpl_entry_name_history" ADD CONSTRAINT "fpl_entry_name_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "bauth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fpl_entry_name_history_user_entry_seen_idx" ON "bauth"."fpl_entry_name_history" USING btree ("user_id","entry_id","last_seen_at");

ALTER TABLE bauth.fpl_entry_name_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY web_auth_runtime_all
    ON bauth.fpl_entry_name_history
    TO letletme_web_auth
    USING (true)
    WITH CHECK (true);

GRANT SELECT, INSERT, DELETE, UPDATE
    ON TABLE bauth.fpl_entry_name_history
    TO letletme_web_auth;
