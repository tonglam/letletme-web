-- Durable replay protection for signed internal bug-report storage requests.
-- The runtime role can use this table only through the explicit RLS policy;
-- migration ownership remains with the migration operator.

CREATE TABLE bauth.bug_report_storage_nonces (
    nonce text PRIMARY KEY,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bug_report_storage_nonces_nonce_nonempty
        CHECK (btrim(nonce) <> '')
);

CREATE INDEX bug_report_storage_nonces_expires_idx
    ON bauth.bug_report_storage_nonces (expires_at);

ALTER TABLE bauth.bug_report_storage_nonces ENABLE ROW LEVEL SECURITY;

CREATE POLICY web_auth_runtime_all
    ON bauth.bug_report_storage_nonces
    TO letletme_web_auth
    USING (true)
    WITH CHECK (true);

GRANT SELECT, INSERT, DELETE, UPDATE
    ON TABLE bauth.bug_report_storage_nonces
    TO letletme_web_auth;
