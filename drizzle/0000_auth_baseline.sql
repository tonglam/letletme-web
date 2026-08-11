DO $canonical_auth_roles$
DECLARE
    role_row record;
BEGIN
    IF current_setting('server_version_num')::integer < 150000 THEN
        RAISE EXCEPTION 'LetLetMe Web requires PostgreSQL 15 or newer (found %)', version();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'letletme_web_auth') THEN
        CREATE ROLE letletme_web_auth
            NOLOGIN
            NOSUPERUSER
            NOCREATEDB
            NOCREATEROLE
            NOINHERIT
            NOREPLICATION
            NOBYPASSRLS;
    END IF;

    SELECT
        rolcanlogin,
        rolsuper,
        rolcreatedb,
        rolcreaterole,
        rolinherit,
        rolreplication,
        rolbypassrls
    INTO STRICT role_row
    FROM pg_roles
    WHERE rolname = 'letletme_web_auth';

    IF role_row.rolcanlogin
        OR role_row.rolsuper
        OR role_row.rolcreatedb
        OR role_row.rolcreaterole
        OR role_row.rolinherit
        OR role_row.rolreplication
        OR role_row.rolbypassrls THEN
        RAISE EXCEPTION 'letletme_web_auth exists with unsafe role attributes';
    END IF;

    SELECT
        rolcanlogin,
        rolsuper,
        rolcreatedb,
        rolcreaterole,
        rolinherit,
        rolreplication,
        rolbypassrls
    INTO role_row
    FROM pg_roles
    WHERE rolname = 'letletme_graphql_reader';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'letletme_graphql_reader must be created by the Data platform first';
    END IF;

    IF role_row.rolcanlogin
        OR role_row.rolsuper
        OR role_row.rolcreatedb
        OR role_row.rolcreaterole
        OR role_row.rolinherit
        OR role_row.rolreplication
        OR role_row.rolbypassrls THEN
        RAISE EXCEPTION 'letletme_graphql_reader exists with unsafe role attributes';
    END IF;
END
$canonical_auth_roles$;

CREATE SCHEMA bauth;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: bauth; Owner: -
--

CREATE TABLE bauth.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: bauth; Owner: -
--

CREATE SEQUENCE bauth.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: bauth; Owner: -
--

ALTER SEQUENCE bauth.__drizzle_migrations_id_seq OWNED BY bauth.__drizzle_migrations.id;


--
-- Name: account; Type: TABLE; Schema: bauth; Owner: -
--

CREATE TABLE bauth.account (
    id text NOT NULL,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    user_id text NOT NULL,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at timestamp with time zone,
    refresh_token_expires_at timestamp with time zone,
    scope text,
    password text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fpl_entry_binding_challenges; Type: TABLE; Schema: bauth; Owner: -
--

CREATE TABLE bauth.fpl_entry_binding_challenges (
    id text NOT NULL,
    user_id text NOT NULL,
    entry_id integer NOT NULL,
    required_name text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mini_program_email_code; Type: TABLE; Schema: bauth; Owner: -
--

CREATE TABLE bauth.mini_program_email_code (
    id text NOT NULL,
    email text NOT NULL,
    device_id text NOT NULL,
    code_hash text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mini_program_session; Type: TABLE; Schema: bauth; Owner: -
--

CREATE TABLE bauth.mini_program_session (
    id text NOT NULL,
    token_hash text NOT NULL,
    user_id text NOT NULL,
    device_id text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    last_used_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: request_rate_limits; Type: TABLE; Schema: bauth; Owner: -
--

CREATE TABLE bauth.request_rate_limits (
    scope text NOT NULL,
    subject text NOT NULL,
    bucket_start timestamp with time zone NOT NULL,
    window_seconds integer NOT NULL,
    count integer NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT request_rate_limits_count_check CHECK ((count > 0)),
    CONSTRAINT request_rate_limits_window_seconds_check CHECK ((window_seconds > 0))
);


--
-- Name: session; Type: TABLE; Schema: bauth; Owner: -
--

CREATE TABLE bauth.session (
    id text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    token text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_address text,
    user_agent text,
    user_id text NOT NULL
);


--
-- Name: user; Type: TABLE; Schema: bauth; Owner: -
--

CREATE TABLE bauth."user" (
    id text NOT NULL,
    name text,
    email text,
    email_verified boolean DEFAULT false NOT NULL,
    image text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    fpl_entry_id integer,
    fpl_entry_bound_at timestamp with time zone,
    openid text,
    fpl_entry_verified_at timestamp with time zone,
    fpl_team_name text,
    fpl_manager_name text,
    fpl_identity_refreshed_at timestamp with time zone
);


--
-- Name: verification; Type: TABLE; Schema: bauth; Owner: -
--

CREATE TABLE bauth.verification (
    id text NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: bauth; Owner: -
--

ALTER TABLE ONLY bauth.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('bauth.__drizzle_migrations_id_seq'::regclass);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: bauth; Owner: -
--

ALTER TABLE ONLY bauth.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: bauth; Owner: -
--

ALTER TABLE ONLY bauth.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: fpl_entry_binding_challenges fpl_entry_binding_challenges_pkey; Type: CONSTRAINT; Schema: bauth; Owner: -
--

ALTER TABLE ONLY bauth.fpl_entry_binding_challenges
    ADD CONSTRAINT fpl_entry_binding_challenges_pkey PRIMARY KEY (id);


--
-- Name: mini_program_email_code mini_program_email_code_pkey; Type: CONSTRAINT; Schema: bauth; Owner: -
--

ALTER TABLE ONLY bauth.mini_program_email_code
    ADD CONSTRAINT mini_program_email_code_pkey PRIMARY KEY (id);


--
-- Name: mini_program_session mini_program_session_pkey; Type: CONSTRAINT; Schema: bauth; Owner: -
--

ALTER TABLE ONLY bauth.mini_program_session
    ADD CONSTRAINT mini_program_session_pkey PRIMARY KEY (id);


--
-- Name: request_rate_limits request_rate_limits_pk; Type: CONSTRAINT; Schema: bauth; Owner: -
--

ALTER TABLE ONLY bauth.request_rate_limits
    ADD CONSTRAINT request_rate_limits_pk PRIMARY KEY (scope, subject, bucket_start);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: bauth; Owner: -
--

ALTER TABLE ONLY bauth.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: session session_token_unique; Type: CONSTRAINT; Schema: bauth; Owner: -
--

ALTER TABLE ONLY bauth.session
    ADD CONSTRAINT session_token_unique UNIQUE (token);


--
-- Name: user user_email_unique; Type: CONSTRAINT; Schema: bauth; Owner: -
--

ALTER TABLE ONLY bauth."user"
    ADD CONSTRAINT user_email_unique UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: bauth; Owner: -
--

ALTER TABLE ONLY bauth."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: verification verification_pkey; Type: CONSTRAINT; Schema: bauth; Owner: -
--

ALTER TABLE ONLY bauth.verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);


--
-- Name: fpl_entry_binding_challenges_pending_idx; Type: INDEX; Schema: bauth; Owner: -
--

CREATE INDEX fpl_entry_binding_challenges_pending_idx ON bauth.fpl_entry_binding_challenges USING btree (user_id, expires_at) WHERE (consumed_at IS NULL);


--
-- Name: fpl_entry_binding_challenges_user_created_idx; Type: INDEX; Schema: bauth; Owner: -
--

CREATE INDEX fpl_entry_binding_challenges_user_created_idx ON bauth.fpl_entry_binding_challenges USING btree (user_id, created_at);


--
-- Name: mini_program_email_code_pending_unique; Type: INDEX; Schema: bauth; Owner: -
--

CREATE UNIQUE INDEX mini_program_email_code_pending_unique ON bauth.mini_program_email_code USING btree (email, device_id) WHERE (consumed_at IS NULL);


--
-- Name: mini_program_session_active_user_device_unique; Type: INDEX; Schema: bauth; Owner: -
--

CREATE UNIQUE INDEX mini_program_session_active_user_device_unique ON bauth.mini_program_session USING btree (user_id, device_id) WHERE (revoked_at IS NULL);


--
-- Name: mini_program_session_token_hash_idx; Type: INDEX; Schema: bauth; Owner: -
--

CREATE UNIQUE INDEX mini_program_session_token_hash_idx ON bauth.mini_program_session USING btree (token_hash);


--
-- Name: request_rate_limits_expires_idx; Type: INDEX; Schema: bauth; Owner: -
--

CREATE INDEX request_rate_limits_expires_idx ON bauth.request_rate_limits USING btree (expires_at);


--
-- Name: user_openid_unique; Type: INDEX; Schema: bauth; Owner: -
--

CREATE UNIQUE INDEX user_openid_unique ON bauth."user" USING btree (openid) WHERE (openid IS NOT NULL);


--
-- Name: user_verified_fpl_entry_unique; Type: INDEX; Schema: bauth; Owner: -
--

CREATE UNIQUE INDEX user_verified_fpl_entry_unique ON bauth."user" USING btree (fpl_entry_id) WHERE (fpl_entry_verified_at IS NOT NULL);


--
-- Name: account account_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: bauth; Owner: -
--

ALTER TABLE ONLY bauth.account
    ADD CONSTRAINT account_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES bauth."user"(id) ON DELETE CASCADE;


--
-- Name: fpl_entry_binding_challenges fpl_entry_binding_challenges_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: bauth; Owner: -
--

ALTER TABLE ONLY bauth.fpl_entry_binding_challenges
    ADD CONSTRAINT fpl_entry_binding_challenges_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES bauth."user"(id) ON DELETE CASCADE;


--
-- Name: mini_program_session mini_program_session_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: bauth; Owner: -
--

ALTER TABLE ONLY bauth.mini_program_session
    ADD CONSTRAINT mini_program_session_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES bauth."user"(id) ON DELETE CASCADE;


--
-- Name: session session_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: bauth; Owner: -
--

ALTER TABLE ONLY bauth.session
    ADD CONSTRAINT session_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES bauth."user"(id) ON DELETE CASCADE;


--
-- Name: __drizzle_migrations; Type: ROW SECURITY; Schema: bauth; Owner: -
--

ALTER TABLE bauth.__drizzle_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: account; Type: ROW SECURITY; Schema: bauth; Owner: -
--

ALTER TABLE bauth.account ENABLE ROW LEVEL SECURITY;

--
-- Name: fpl_entry_binding_challenges; Type: ROW SECURITY; Schema: bauth; Owner: -
--

ALTER TABLE bauth.fpl_entry_binding_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mini_program_session graphql_auth_reader_select; Type: POLICY; Schema: bauth; Owner: -
--

CREATE POLICY graphql_auth_reader_select ON bauth.mini_program_session FOR SELECT TO letletme_graphql_reader USING (true);


--
-- Name: user graphql_auth_reader_select; Type: POLICY; Schema: bauth; Owner: -
--

CREATE POLICY graphql_auth_reader_select ON bauth."user" FOR SELECT TO letletme_graphql_reader USING (true);


--
-- Name: mini_program_email_code; Type: ROW SECURITY; Schema: bauth; Owner: -
--

ALTER TABLE bauth.mini_program_email_code ENABLE ROW LEVEL SECURITY;

--
-- Name: mini_program_session; Type: ROW SECURITY; Schema: bauth; Owner: -
--

ALTER TABLE bauth.mini_program_session ENABLE ROW LEVEL SECURITY;

--
-- Name: request_rate_limits; Type: ROW SECURITY; Schema: bauth; Owner: -
--

ALTER TABLE bauth.request_rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: session; Type: ROW SECURITY; Schema: bauth; Owner: -
--

ALTER TABLE bauth.session ENABLE ROW LEVEL SECURITY;

--
-- Name: user; Type: ROW SECURITY; Schema: bauth; Owner: -
--

ALTER TABLE bauth."user" ENABLE ROW LEVEL SECURITY;

--
-- Name: verification; Type: ROW SECURITY; Schema: bauth; Owner: -
--

ALTER TABLE bauth.verification ENABLE ROW LEVEL SECURITY;

--
-- Name: account web_auth_runtime_all; Type: POLICY; Schema: bauth; Owner: -
--

CREATE POLICY web_auth_runtime_all ON bauth.account TO letletme_web_auth USING (true) WITH CHECK (true);


--
-- Name: fpl_entry_binding_challenges web_auth_runtime_all; Type: POLICY; Schema: bauth; Owner: -
--

CREATE POLICY web_auth_runtime_all ON bauth.fpl_entry_binding_challenges TO letletme_web_auth USING (true) WITH CHECK (true);


--
-- Name: mini_program_email_code web_auth_runtime_all; Type: POLICY; Schema: bauth; Owner: -
--

CREATE POLICY web_auth_runtime_all ON bauth.mini_program_email_code TO letletme_web_auth USING (true) WITH CHECK (true);


--
-- Name: mini_program_session web_auth_runtime_all; Type: POLICY; Schema: bauth; Owner: -
--

CREATE POLICY web_auth_runtime_all ON bauth.mini_program_session TO letletme_web_auth USING (true) WITH CHECK (true);


--
-- Name: request_rate_limits web_auth_runtime_all; Type: POLICY; Schema: bauth; Owner: -
--

CREATE POLICY web_auth_runtime_all ON bauth.request_rate_limits TO letletme_web_auth USING (true) WITH CHECK (true);


--
-- Name: session web_auth_runtime_all; Type: POLICY; Schema: bauth; Owner: -
--

CREATE POLICY web_auth_runtime_all ON bauth.session TO letletme_web_auth USING (true) WITH CHECK (true);


--
-- Name: user web_auth_runtime_all; Type: POLICY; Schema: bauth; Owner: -
--

CREATE POLICY web_auth_runtime_all ON bauth."user" TO letletme_web_auth USING (true) WITH CHECK (true);


--
-- Name: verification web_auth_runtime_all; Type: POLICY; Schema: bauth; Owner: -
--

CREATE POLICY web_auth_runtime_all ON bauth.verification TO letletme_web_auth USING (true) WITH CHECK (true);


--
-- Name: SCHEMA bauth; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA bauth TO letletme_web_auth;
GRANT USAGE ON SCHEMA bauth TO letletme_graphql_reader;


--
-- Name: TABLE account; Type: ACL; Schema: bauth; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE bauth.account TO letletme_web_auth;


--
-- Name: TABLE fpl_entry_binding_challenges; Type: ACL; Schema: bauth; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE bauth.fpl_entry_binding_challenges TO letletme_web_auth;


--
-- Name: TABLE mini_program_email_code; Type: ACL; Schema: bauth; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE bauth.mini_program_email_code TO letletme_web_auth;


--
-- Name: TABLE mini_program_session; Type: ACL; Schema: bauth; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE bauth.mini_program_session TO letletme_web_auth;


--
-- Name: COLUMN mini_program_session.token_hash; Type: ACL; Schema: bauth; Owner: -
--

GRANT SELECT(token_hash) ON TABLE bauth.mini_program_session TO letletme_graphql_reader;


--
-- Name: COLUMN mini_program_session.user_id; Type: ACL; Schema: bauth; Owner: -
--

GRANT SELECT(user_id) ON TABLE bauth.mini_program_session TO letletme_graphql_reader;


--
-- Name: COLUMN mini_program_session.expires_at; Type: ACL; Schema: bauth; Owner: -
--

GRANT SELECT(expires_at) ON TABLE bauth.mini_program_session TO letletme_graphql_reader;


--
-- Name: COLUMN mini_program_session.revoked_at; Type: ACL; Schema: bauth; Owner: -
--

GRANT SELECT(revoked_at) ON TABLE bauth.mini_program_session TO letletme_graphql_reader;


--
-- Name: TABLE request_rate_limits; Type: ACL; Schema: bauth; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE bauth.request_rate_limits TO letletme_web_auth;


--
-- Name: TABLE session; Type: ACL; Schema: bauth; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE bauth.session TO letletme_web_auth;


--
-- Name: TABLE "user"; Type: ACL; Schema: bauth; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE bauth."user" TO letletme_web_auth;


--
-- Name: COLUMN "user".id; Type: ACL; Schema: bauth; Owner: -
--

GRANT SELECT(id) ON TABLE bauth."user" TO letletme_graphql_reader;


--
-- Name: COLUMN "user".fpl_entry_id; Type: ACL; Schema: bauth; Owner: -
--

GRANT SELECT(fpl_entry_id) ON TABLE bauth."user" TO letletme_graphql_reader;


--
-- Name: COLUMN "user".fpl_entry_verified_at; Type: ACL; Schema: bauth; Owner: -
--

GRANT SELECT(fpl_entry_verified_at) ON TABLE bauth."user" TO letletme_graphql_reader;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE bauth.verification TO letletme_web_auth;

REVOKE ALL ON SCHEMA bauth FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA bauth FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA bauth FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA bauth FROM PUBLIC;

REVOKE CREATE ON SCHEMA bauth FROM letletme_web_auth;
REVOKE CREATE ON SCHEMA bauth FROM letletme_graphql_reader;
REVOKE ALL ON TABLE bauth.__drizzle_migrations FROM letletme_web_auth;
REVOKE ALL ON SEQUENCE bauth.__drizzle_migrations_id_seq FROM letletme_web_auth;
REVOKE ALL ON TABLE bauth.__drizzle_migrations FROM letletme_graphql_reader;
REVOKE ALL ON SEQUENCE bauth.__drizzle_migrations_id_seq FROM letletme_graphql_reader;

DO $canonical_auth_client_boundary$
DECLARE
    client_role text;
BEGIN
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
            EXECUTE format('REVOKE ALL ON SCHEMA bauth FROM %I', client_role);
            EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA bauth FROM %I', client_role);
            EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA bauth FROM %I', client_role);
            EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA bauth FROM %I', client_role);
            EXECUTE format(
                'ALTER DEFAULT PRIVILEGES IN SCHEMA bauth REVOKE ALL ON TABLES FROM %I',
                client_role
            );
            EXECUTE format(
                'ALTER DEFAULT PRIVILEGES IN SCHEMA bauth REVOKE ALL ON SEQUENCES FROM %I',
                client_role
            );
            EXECUTE format(
                'ALTER DEFAULT PRIVILEGES IN SCHEMA bauth REVOKE ALL ON FUNCTIONS FROM %I',
                client_role
            );
        END IF;
    END LOOP;
END
$canonical_auth_client_boundary$;

ALTER DEFAULT PRIVILEGES IN SCHEMA bauth REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA bauth REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA bauth REVOKE ALL ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA bauth REVOKE ALL ON TABLES FROM letletme_web_auth;
ALTER DEFAULT PRIVILEGES IN SCHEMA bauth REVOKE ALL ON SEQUENCES FROM letletme_web_auth;
ALTER DEFAULT PRIVILEGES IN SCHEMA bauth REVOKE ALL ON TABLES FROM letletme_graphql_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA bauth REVOKE ALL ON SEQUENCES FROM letletme_graphql_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA bauth REVOKE ALL ON FUNCTIONS FROM letletme_graphql_reader;

DO $canonical_auth_data_boundary$
DECLARE
    schema_name text;
BEGIN
    FOREACH schema_name IN ARRAY ARRAY[
        'fpl',
        'competition',
        'understat',
        'bridge',
        'reporting',
        'ops'
    ]
    LOOP
        IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = schema_name) THEN
            EXECUTE format('REVOKE ALL ON SCHEMA %I FROM letletme_web_auth', schema_name);
            EXECUTE format(
                'REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM letletme_web_auth',
                schema_name
            );
            EXECUTE format(
                'REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM letletme_web_auth',
                schema_name
            );
            EXECUTE format(
                'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM letletme_web_auth',
                schema_name
            );
        END IF;
    END LOOP;
END
$canonical_auth_data_boundary$;
