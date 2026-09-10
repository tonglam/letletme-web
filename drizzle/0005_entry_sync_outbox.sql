-- Durable Web-to-Data hand-off ledger. The table is intentionally Web-owned;
-- Data, GraphQL and clients never receive credentials or direct access to it.
CREATE TABLE bauth.entry_sync_outbox (
    entry_id integer PRIMARY KEY,
    generation integer NOT NULL DEFAULT 1,
    status text NOT NULL DEFAULT 'pending',
    attempts integer NOT NULL DEFAULT 0,
    next_attempt_at timestamp with time zone NOT NULL DEFAULT now(),
    lease_token text,
    lease_until timestamp with time zone,
    data_job_id text,
    last_error_code text,
    last_error text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT entry_sync_outbox_entry_positive CHECK (entry_id > 0),
    CONSTRAINT entry_sync_outbox_generation_positive CHECK (generation > 0),
    CONSTRAINT entry_sync_outbox_attempts_nonnegative CHECK (attempts >= 0),
    CONSTRAINT entry_sync_outbox_status_valid CHECK (status IN ('pending', 'leased', 'delivered'))
);

CREATE INDEX entry_sync_outbox_due_idx
    ON bauth.entry_sync_outbox (status, next_attempt_at, entry_id);
CREATE INDEX entry_sync_outbox_lease_idx
    ON bauth.entry_sync_outbox (lease_until);
CREATE INDEX entry_sync_outbox_delivered_retention_idx
    ON bauth.entry_sync_outbox (status, updated_at);

ALTER TABLE bauth.entry_sync_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY web_auth_runtime_all
    ON bauth.entry_sync_outbox
    TO letletme_web_auth
    USING (true)
    WITH CHECK (true);

GRANT SELECT, INSERT, DELETE, UPDATE
    ON TABLE bauth.entry_sync_outbox
    TO letletme_web_auth;
