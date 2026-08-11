import { createHash } from 'node:crypto'

import postgres from 'postgres'

type QueryClient = postgres.Sql | postgres.TransactionSql

export type AuthSchemaContractRow = {
	section: string
	identity: string
	definition: string
}

type AuthCapabilityMembership = {
	grantedRole: string
	memberRole: string
	adminOption: boolean
}

const fullContractQuery = `
WITH contract_rows AS (
	SELECT
		'schema'::text AS section,
		namespace_row.nspname::text AS identity,
		jsonb_build_object(
			'owner', CASE
				WHEN namespace_row.nspowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
					THEN '$MIGRATION_ACTOR'
				ELSE pg_get_userbyid(namespace_row.nspowner)
			END,
			'acl', COALESCE((
				SELECT jsonb_agg(
					jsonb_build_object(
						'grantor', CASE
							WHEN acl_row.grantor = (SELECT oid FROM pg_roles WHERE rolname = current_user)
								THEN '$MIGRATION_ACTOR'
							ELSE pg_get_userbyid(acl_row.grantor)
						END,
						'grantee', CASE
							WHEN acl_row.grantee = 0 THEN 'PUBLIC'
							WHEN acl_row.grantee = (SELECT oid FROM pg_roles WHERE rolname = current_user)
								THEN '$MIGRATION_ACTOR'
							ELSE pg_get_userbyid(acl_row.grantee)
						END,
						'privilege', acl_row.privilege_type,
						'grantable', acl_row.is_grantable
					)
					ORDER BY
						CASE
							WHEN acl_row.grantor = (SELECT oid FROM pg_roles WHERE rolname = current_user)
								THEN '$MIGRATION_ACTOR'
							ELSE pg_get_userbyid(acl_row.grantor)
						END,
						CASE
							WHEN acl_row.grantee = 0 THEN 'PUBLIC'
							WHEN acl_row.grantee = (SELECT oid FROM pg_roles WHERE rolname = current_user)
								THEN '$MIGRATION_ACTOR'
							ELSE pg_get_userbyid(acl_row.grantee)
						END,
						acl_row.privilege_type,
						acl_row.is_grantable
				)
				FROM aclexplode(COALESCE(namespace_row.nspacl, acldefault('n', namespace_row.nspowner))) acl_row
			), '[]'::jsonb)
		)::text AS definition
	FROM pg_namespace namespace_row
	WHERE namespace_row.nspname = 'bauth'

	UNION ALL

	SELECT
		'role'::text,
		role_row.rolname::text,
		jsonb_build_object(
			'login', role_row.rolcanlogin,
			'superuser', role_row.rolsuper,
			'createdb', role_row.rolcreatedb,
			'createrole', role_row.rolcreaterole,
			'inherit', role_row.rolinherit,
			'replication', role_row.rolreplication,
			'bypassrls', role_row.rolbypassrls,
			'connectionLimit', role_row.rolconnlimit,
			'validUntil', role_row.rolvaliduntil
		)::text
	FROM pg_roles role_row
	WHERE role_row.rolname IN ('letletme_graphql_reader', 'letletme_web_auth')

	UNION ALL

	SELECT
		'type'::text,
		namespace_row.nspname || '.' || type_row.typname,
		jsonb_build_object(
			'kind', type_row.typtype,
			'category', type_row.typcategory,
			'owner', CASE
				WHEN type_row.typowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
					THEN '$MIGRATION_ACTOR'
				ELSE pg_get_userbyid(type_row.typowner)
			END,
			'notNull', type_row.typnotnull,
			'default', type_row.typdefault,
			'labels', COALESCE((
				SELECT jsonb_agg(enum_row.enumlabel ORDER BY enum_row.enumsortorder)
				FROM pg_enum enum_row
				WHERE enum_row.enumtypid = type_row.oid
			), '[]'::jsonb)
		)::text
	FROM pg_type type_row
	JOIN pg_namespace namespace_row ON namespace_row.oid = type_row.typnamespace
	WHERE namespace_row.nspname = 'bauth'
		AND type_row.typtype IN ('d', 'e', 'm', 'r')

	UNION ALL

	SELECT
		'relation'::text,
		namespace_row.nspname || '.' || relation_row.relname,
		jsonb_build_object(
			'kind', relation_row.relkind,
			'owner', CASE
				WHEN relation_row.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
					THEN '$MIGRATION_ACTOR'
				ELSE pg_get_userbyid(relation_row.relowner)
			END,
			'persistence', relation_row.relpersistence,
			'rowSecurity', relation_row.relrowsecurity,
			'forceRowSecurity', relation_row.relforcerowsecurity,
			'acl', COALESCE((
				SELECT jsonb_agg(
					jsonb_build_object(
						'grantor', CASE
							WHEN acl_row.grantor = (SELECT oid FROM pg_roles WHERE rolname = current_user)
								THEN '$MIGRATION_ACTOR'
							ELSE pg_get_userbyid(acl_row.grantor)
						END,
						'grantee', CASE
							WHEN acl_row.grantee = 0 THEN 'PUBLIC'
							WHEN acl_row.grantee = (SELECT oid FROM pg_roles WHERE rolname = current_user)
								THEN '$MIGRATION_ACTOR'
							ELSE pg_get_userbyid(acl_row.grantee)
						END,
						'privilege', acl_row.privilege_type,
						'grantable', acl_row.is_grantable
					)
					ORDER BY
						CASE
							WHEN acl_row.grantor = (SELECT oid FROM pg_roles WHERE rolname = current_user)
								THEN '$MIGRATION_ACTOR'
							ELSE pg_get_userbyid(acl_row.grantor)
						END,
						CASE
							WHEN acl_row.grantee = 0 THEN 'PUBLIC'
							WHEN acl_row.grantee = (SELECT oid FROM pg_roles WHERE rolname = current_user)
								THEN '$MIGRATION_ACTOR'
							ELSE pg_get_userbyid(acl_row.grantee)
						END,
						acl_row.privilege_type,
						acl_row.is_grantable
				)
				FROM aclexplode(
					COALESCE(
						relation_row.relacl,
						acldefault(
							(CASE WHEN relation_row.relkind = 'S' THEN 'S' ELSE 'r' END)::"char",
							relation_row.relowner
						)
					)
				) acl_row
			), '[]'::jsonb)
		)::text
	FROM pg_class relation_row
	JOIN pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
	WHERE namespace_row.nspname = 'bauth'
		AND relation_row.relkind IN ('r', 'p', 'v', 'm', 'S')

	UNION ALL

	SELECT
		'column'::text,
		namespace_row.nspname || '.' || relation_row.relname || '.' || attribute_row.attname,
		jsonb_build_object(
			'position', attribute_row.attnum,
			'type', format_type(attribute_row.atttypid, attribute_row.atttypmod),
			'notNull', attribute_row.attnotnull,
			'default', pg_get_expr(default_row.adbin, default_row.adrelid, true),
			'identity', attribute_row.attidentity,
			'generated', attribute_row.attgenerated,
			'collation', CASE
				WHEN attribute_row.attcollation = 0 THEN NULL
				ELSE attribute_row.attcollation::regcollation::text
			END,
			'acl', COALESCE((
				SELECT jsonb_agg(
					jsonb_build_object(
						'grantor', CASE
							WHEN acl_row.grantor = (SELECT oid FROM pg_roles WHERE rolname = current_user)
								THEN '$MIGRATION_ACTOR'
							ELSE pg_get_userbyid(acl_row.grantor)
						END,
						'grantee', CASE
							WHEN acl_row.grantee = 0 THEN 'PUBLIC'
							WHEN acl_row.grantee = (SELECT oid FROM pg_roles WHERE rolname = current_user)
								THEN '$MIGRATION_ACTOR'
							ELSE pg_get_userbyid(acl_row.grantee)
						END,
						'privilege', acl_row.privilege_type,
						'grantable', acl_row.is_grantable
					)
					ORDER BY
						CASE
							WHEN acl_row.grantor = (SELECT oid FROM pg_roles WHERE rolname = current_user)
								THEN '$MIGRATION_ACTOR'
							ELSE pg_get_userbyid(acl_row.grantor)
						END,
						CASE
							WHEN acl_row.grantee = 0 THEN 'PUBLIC'
							WHEN acl_row.grantee = (SELECT oid FROM pg_roles WHERE rolname = current_user)
								THEN '$MIGRATION_ACTOR'
							ELSE pg_get_userbyid(acl_row.grantee)
						END,
						acl_row.privilege_type,
						acl_row.is_grantable
				)
				FROM aclexplode(attribute_row.attacl) acl_row
			), '[]'::jsonb)
		)::text
	FROM pg_attribute attribute_row
	JOIN pg_class relation_row ON relation_row.oid = attribute_row.attrelid
	JOIN pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
	LEFT JOIN pg_attrdef default_row
		ON default_row.adrelid = attribute_row.attrelid
		AND default_row.adnum = attribute_row.attnum
	WHERE namespace_row.nspname = 'bauth'
		AND relation_row.relkind IN ('r', 'p', 'v', 'm')
		AND attribute_row.attnum > 0
		AND NOT attribute_row.attisdropped

	UNION ALL

	SELECT
		'constraint'::text,
		namespace_row.nspname || '.' || relation_row.relname || '.' || constraint_row.conname,
		jsonb_build_object(
			'type', constraint_row.contype,
			'deferrable', constraint_row.condeferrable,
			'deferred', constraint_row.condeferred,
			'validated', constraint_row.convalidated,
			'noInherit', constraint_row.connoinherit,
			'definition', pg_get_constraintdef(constraint_row.oid, true)
		)::text
	FROM pg_constraint constraint_row
	JOIN pg_class relation_row ON relation_row.oid = constraint_row.conrelid
	JOIN pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
	WHERE namespace_row.nspname = 'bauth'

	UNION ALL

	SELECT
		'view'::text,
		namespace_row.nspname || '.' || relation_row.relname,
		jsonb_build_object(
			'kind', relation_row.relkind,
			'definition', pg_get_viewdef(relation_row.oid, true),
			'options', COALESCE(to_jsonb(relation_row.reloptions), '[]'::jsonb)
		)::text
	FROM pg_class relation_row
	JOIN pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
	WHERE namespace_row.nspname = 'bauth'
		AND relation_row.relkind IN ('v', 'm')

	UNION ALL

	SELECT
		'function'::text,
		namespace_row.nspname || '.' || function_row.proname || '(' ||
			pg_get_function_identity_arguments(function_row.oid) || ')',
		jsonb_build_object(
			'owner', CASE
				WHEN function_row.proowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
					THEN '$MIGRATION_ACTOR'
				ELSE pg_get_userbyid(function_row.proowner)
			END,
			'language', language_row.lanname,
			'result', pg_get_function_result(function_row.oid),
			'kind', function_row.prokind,
			'volatility', function_row.provolatile,
			'strict', function_row.proisstrict,
			'securityDefiner', function_row.prosecdef,
			'leakproof', function_row.proleakproof,
			'parallel', function_row.proparallel,
			'config', COALESCE(to_jsonb(function_row.proconfig), '[]'::jsonb),
			'definition', pg_get_functiondef(function_row.oid)
		)::text
	FROM pg_proc function_row
	JOIN pg_namespace namespace_row ON namespace_row.oid = function_row.pronamespace
	JOIN pg_language language_row ON language_row.oid = function_row.prolang
	WHERE namespace_row.nspname = 'bauth'

	UNION ALL

	SELECT
		'index'::text,
		namespace_row.nspname || '.' || index_relation.relname,
		jsonb_build_object(
			'table', namespace_row.nspname || '.' || table_relation.relname,
			'owner', CASE
				WHEN index_relation.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
					THEN '$MIGRATION_ACTOR'
				ELSE pg_get_userbyid(index_relation.relowner)
			END,
			'unique', index_row.indisunique,
			'primary', index_row.indisprimary,
			'valid', index_row.indisvalid,
			'ready', index_row.indisready,
			'definition', pg_get_indexdef(index_relation.oid)
		)::text
	FROM pg_index index_row
	JOIN pg_class index_relation ON index_relation.oid = index_row.indexrelid
	JOIN pg_class table_relation ON table_relation.oid = index_row.indrelid
	JOIN pg_namespace namespace_row ON namespace_row.oid = table_relation.relnamespace
	WHERE namespace_row.nspname = 'bauth'

	UNION ALL

	SELECT
		'sequence'::text,
		namespace_row.nspname || '.' || sequence_relation.relname,
		jsonb_build_object(
			'type', format_type(sequence_row.seqtypid, NULL),
			'start', sequence_row.seqstart,
			'increment', sequence_row.seqincrement,
			'min', sequence_row.seqmin,
			'max', sequence_row.seqmax,
			'cache', sequence_row.seqcache,
			'cycle', sequence_row.seqcycle,
			'ownedBy', owned_namespace.nspname || '.' || owned_relation.relname || '.' || owned_attribute.attname
		)::text
	FROM pg_sequence sequence_row
	JOIN pg_class sequence_relation ON sequence_relation.oid = sequence_row.seqrelid
	JOIN pg_namespace namespace_row ON namespace_row.oid = sequence_relation.relnamespace
	LEFT JOIN pg_depend ownership
		ON ownership.classid = 'pg_class'::regclass
		AND ownership.objid = sequence_relation.oid
		AND ownership.deptype IN ('a', 'i')
		AND ownership.refclassid = 'pg_class'::regclass
	LEFT JOIN pg_class owned_relation ON owned_relation.oid = ownership.refobjid
	LEFT JOIN pg_namespace owned_namespace ON owned_namespace.oid = owned_relation.relnamespace
	LEFT JOIN pg_attribute owned_attribute
		ON owned_attribute.attrelid = ownership.refobjid
		AND owned_attribute.attnum = ownership.refobjsubid
	WHERE namespace_row.nspname = 'bauth'

	UNION ALL

	SELECT
		'policy'::text,
		policy_row.schemaname || '.' || policy_row.tablename || '.' || policy_row.policyname,
		jsonb_build_object(
			'permissive', policy_row.permissive,
			'roles', to_jsonb(policy_row.roles),
			'command', policy_row.cmd,
			'using', policy_row.qual,
			'check', policy_row.with_check
		)::text
	FROM pg_policies policy_row
	WHERE policy_row.schemaname = 'bauth'

	UNION ALL

	SELECT
		'trigger'::text,
		namespace_row.nspname || '.' || relation_row.relname || '.' || trigger_row.tgname,
		jsonb_build_object(
			'enabled', trigger_row.tgenabled,
			'definition', pg_get_triggerdef(trigger_row.oid, true)
		)::text
	FROM pg_trigger trigger_row
	JOIN pg_class relation_row ON relation_row.oid = trigger_row.tgrelid
	JOIN pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
	WHERE namespace_row.nspname = 'bauth'
		AND NOT trigger_row.tgisinternal

	UNION ALL

	SELECT
		'default-acl'::text,
		CASE
			WHEN default_acl.defaclrole = (SELECT oid FROM pg_roles WHERE rolname = current_user)
				THEN '$MIGRATION_ACTOR'
			ELSE pg_get_userbyid(default_acl.defaclrole)
		END || ':bauth:' || default_acl.defaclobjtype::text,
		COALESCE((
			SELECT jsonb_agg(
				jsonb_build_object(
					'grantor', CASE
						WHEN acl_row.grantor = (SELECT oid FROM pg_roles WHERE rolname = current_user)
							THEN '$MIGRATION_ACTOR'
						ELSE pg_get_userbyid(acl_row.grantor)
					END,
					'grantee', CASE
						WHEN acl_row.grantee = 0 THEN 'PUBLIC'
						WHEN acl_row.grantee = (SELECT oid FROM pg_roles WHERE rolname = current_user)
							THEN '$MIGRATION_ACTOR'
						ELSE pg_get_userbyid(acl_row.grantee)
					END,
					'privilege', acl_row.privilege_type,
					'grantable', acl_row.is_grantable
				)
				ORDER BY
					CASE
						WHEN acl_row.grantor = (SELECT oid FROM pg_roles WHERE rolname = current_user)
							THEN '$MIGRATION_ACTOR'
						ELSE pg_get_userbyid(acl_row.grantor)
					END,
					CASE
						WHEN acl_row.grantee = 0 THEN 'PUBLIC'
						WHEN acl_row.grantee = (SELECT oid FROM pg_roles WHERE rolname = current_user)
							THEN '$MIGRATION_ACTOR'
						ELSE pg_get_userbyid(acl_row.grantee)
					END,
					acl_row.privilege_type,
					acl_row.is_grantable
			)
			FROM aclexplode(default_acl.defaclacl) acl_row
		), '[]'::jsonb)::text
	FROM pg_default_acl default_acl
	JOIN pg_namespace namespace_row ON namespace_row.oid = default_acl.defaclnamespace
	WHERE namespace_row.nspname = 'bauth'

	UNION ALL

	SELECT
		'boundary'::text,
		'retired_objects'::text,
		jsonb_build_object(
			'drizzleSchema', to_regnamespace('drizzle') IS NOT NULL,
			'apiKeyTable', to_regclass('bauth.apikey') IS NOT NULL,
			'jwkTable', to_regclass('bauth.jwks') IS NOT NULL,
			'rateLimitTable', to_regclass('bauth.rate_limit') IS NOT NULL
		)::text

	UNION ALL

	SELECT
		'boundary'::text,
		'non_extension_public_objects'::text,
		COALESCE(jsonb_agg(
			jsonb_build_object('kind', public_relation.relkind, 'name', public_relation.relname)
			ORDER BY public_relation.relkind, public_relation.relname
		), '[]'::jsonb)::text
	FROM pg_class public_relation
	JOIN pg_namespace public_namespace ON public_namespace.oid = public_relation.relnamespace
	WHERE public_namespace.nspname = 'public'
		AND public_relation.relkind IN ('r', 'p', 'v', 'm', 'S')
		AND NOT EXISTS (
			SELECT 1
			FROM pg_depend dependency
			WHERE dependency.classid = 'pg_class'::regclass
				AND dependency.objid = public_relation.oid
				AND dependency.deptype = 'e'
		)

	UNION ALL

	SELECT
		'boundary'::text,
		'non_extension_public_functions'::text,
		COALESCE(jsonb_agg(
			public_function.proname || '(' ||
				pg_get_function_identity_arguments(public_function.oid) || ')'
			ORDER BY public_function.proname,
				pg_get_function_identity_arguments(public_function.oid)
		), '[]'::jsonb)::text
	FROM pg_proc public_function
	JOIN pg_namespace public_namespace ON public_namespace.oid = public_function.pronamespace
	WHERE public_namespace.nspname = 'public'
		AND NOT EXISTS (
			SELECT 1
			FROM pg_depend dependency
			WHERE dependency.classid = 'pg_proc'::regclass
				AND dependency.objid = public_function.oid
				AND dependency.deptype = 'e'
		)
)
SELECT section, identity, definition
FROM contract_rows
ORDER BY section, identity, definition
`

const mappingContractQuery = `
WITH mapping_rows AS (
	SELECT
		'relation'::text AS section,
		relation_row.relname::text AS identity,
		jsonb_build_object(
			'kind', relation_row.relkind,
			'persistence', relation_row.relpersistence
		)::text AS definition
	FROM pg_class relation_row
	JOIN pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
	WHERE namespace_row.nspname = 'bauth'
		AND relation_row.relkind IN ('r', 'p')
		AND relation_row.relname <> '__drizzle_migrations'

	UNION ALL

	SELECT
		'column'::text,
		relation_row.relname || '.' || attribute_row.attname,
		jsonb_build_object(
			'position', attribute_row.attnum,
			'type', format_type(attribute_row.atttypid, attribute_row.atttypmod),
			'notNull', attribute_row.attnotnull,
			'default', pg_get_expr(default_row.adbin, default_row.adrelid, true),
			'identity', attribute_row.attidentity,
			'generated', attribute_row.attgenerated
		)::text
	FROM pg_attribute attribute_row
	JOIN pg_class relation_row ON relation_row.oid = attribute_row.attrelid
	JOIN pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
	LEFT JOIN pg_attrdef default_row
		ON default_row.adrelid = attribute_row.attrelid
		AND default_row.adnum = attribute_row.attnum
	WHERE namespace_row.nspname = 'bauth'
		AND relation_row.relkind IN ('r', 'p')
		AND relation_row.relname <> '__drizzle_migrations'
		AND attribute_row.attnum > 0
		AND NOT attribute_row.attisdropped

	UNION ALL

	SELECT
		'constraint'::text,
		relation_row.relname || '.' || constraint_row.conname,
		jsonb_build_object(
			'type', constraint_row.contype,
			'deferrable', constraint_row.condeferrable,
			'deferred', constraint_row.condeferred,
			'validated', constraint_row.convalidated,
			'definition', pg_get_constraintdef(constraint_row.oid, true)
		)::text
	FROM pg_constraint constraint_row
	JOIN pg_class relation_row ON relation_row.oid = constraint_row.conrelid
	JOIN pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
	WHERE namespace_row.nspname = 'bauth'
		AND relation_row.relname <> '__drizzle_migrations'

	UNION ALL

	SELECT
		'index'::text,
		index_relation.relname::text,
		jsonb_build_object(
			'table', table_relation.relname,
			'unique', index_row.indisunique,
			'primary', index_row.indisprimary,
			'definition', replace(pg_get_indexdef(index_relation.oid), 'bauth.', '')
		)::text
	FROM pg_index index_row
	JOIN pg_class index_relation ON index_relation.oid = index_row.indexrelid
	JOIN pg_class table_relation ON table_relation.oid = index_row.indrelid
	JOIN pg_namespace namespace_row ON namespace_row.oid = table_relation.relnamespace
	WHERE namespace_row.nspname = 'bauth'
		AND table_relation.relname <> '__drizzle_migrations'
)
SELECT section, identity, definition
FROM mapping_rows
ORDER BY section, identity, definition
`

export async function loadAuthSchemaContract(
	client: QueryClient
): Promise<AuthSchemaContractRow[]> {
	return client.unsafe<AuthSchemaContractRow[]>(fullContractQuery)
}

export async function assertAuthCapabilityMemberships(
	client: QueryClient
): Promise<void> {
	const rows = await client<AuthCapabilityMembership[]>`
		SELECT
			granted_role.rolname AS "grantedRole",
			member_role.rolname AS "memberRole",
			membership.admin_option AS "adminOption"
		FROM pg_auth_members membership
		JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
		JOIN pg_roles member_role ON member_role.oid = membership.member
		WHERE granted_role.rolname IN ('letletme_graphql_reader', 'letletme_web_auth')
			OR member_role.rolname IN ('letletme_graphql_reader', 'letletme_web_auth')
		ORDER BY granted_role.rolname, member_role.rolname
	`

	const allowed = new Set([
		'letletme_graphql_reader->letletme_graphql_runtime',
		'letletme_web_auth->letletme_web_runtime',
		'letletme_graphql_reader->letletme_graphql_local_tong',
		'letletme_web_auth->letletme_web_local_tong'
	])
	const invalid = rows.filter(
		row =>
			!allowed.has(`${row.grantedRole}->${row.memberRole}`) ||
			row.adminOption
	)
	if (invalid.length > 0) {
		throw new Error(
			`Auth capability memberships are unsafe: ${invalid
				.map(row => `${row.grantedRole}->${row.memberRole}`)
				.join(', ')}`
		)
	}
}

export async function loadAuthMappingContract(
	client: QueryClient
): Promise<AuthSchemaContractRow[]> {
	return client.unsafe<AuthSchemaContractRow[]>(mappingContractQuery)
}

export function serializeAuthContract(
	rows: readonly AuthSchemaContractRow[]
): string {
	return [...rows]
		.sort((left, right) =>
			`${left.section}\u0000${left.identity}\u0000${left.definition}`.localeCompare(
				`${right.section}\u0000${right.identity}\u0000${right.definition}`
			)
		)
		.map(row => `${row.section}\u0000${row.identity}\u0000${row.definition}`)
		.join('\n')
}

export function fingerprintAuthContract(
	rows: readonly AuthSchemaContractRow[]
): string {
	return createHash('sha256')
		.update(serializeAuthContract(rows), 'utf8')
		.digest('hex')
}
