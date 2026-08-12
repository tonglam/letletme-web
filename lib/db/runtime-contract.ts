import postgres from 'postgres'

export const WEB_AUTH_CAPABILITY_ROLE = 'letletme_web_auth'
export const GRAPHQL_AUTH_CAPABILITY_ROLE = 'letletme_graphql_reader'

export const WEB_AUTH_RUNTIME_TABLES = [
	'account',
	'fpl_entry_binding_challenges',
	'mini_program_email_code',
	'mini_program_session',
	'request_rate_limits',
	'session',
	'user',
	'verification'
] as const

export const GRAPHQL_AUTH_RUNTIME_TABLES = [
	'mini_program_session',
	'user'
] as const

const DATA_SCHEMAS = [
	'fpl',
	'competition',
	'understat',
	'bridge',
	'reporting',
	'ops'
] as const

const AUTH_RUNTIME_POLICY = 'web_auth_runtime_all'
const GRAPHQL_AUTH_RUNTIME_POLICY = 'graphql_auth_reader_select'

type RoleAttributes = {
	role_name: string
	rolcanlogin: boolean
	rolsuper: boolean
	rolcreatedb: boolean
	rolcreaterole: boolean
	rolinherit: boolean
	rolreplication: boolean
	rolbypassrls: boolean
}

type AuthTableBoundary = {
	table_name: string
	owner_name: string
	rls_enabled: boolean
	can_select: boolean
	can_insert: boolean
	can_update: boolean
	can_delete: boolean
	can_truncate: boolean
	can_references: boolean
	can_trigger: boolean
}

type AuthPolicyBoundary = {
	table_name: string
	policy_name: string
	permissive: string
	roles: string[]
	command: string
	using_expression: string | null
	check_expression: string | null
}

type NamedPrivilegeBoundary = {
	object_name: string
	can_read: boolean
	can_write: boolean
}

export type WebDatabaseContractResult = {
	roleName: string
	capabilityRole: typeof WEB_AUTH_CAPABILITY_ROLE
	authTables: string[]
}

export type WebDatabaseContractOptions = {
	connectTimeoutSeconds?: number
	statementTimeoutMilliseconds?: number
	auditTimeoutMilliseconds?: number
}

export class WebDatabaseContractError extends Error {
	readonly findings: string[]

	constructor(findings: string[]) {
		super(`Web database runtime contract failed: ${findings.join('; ')}`)
		this.name = 'WebDatabaseContractError'
		this.findings = findings
	}
}

export class WebDatabaseContractAuditTimeoutError extends Error {
	constructor(timeoutMilliseconds: number, cause?: unknown) {
		super(
			`Web database runtime contract audit exceeded ${timeoutMilliseconds}ms`,
			{ cause }
		)
		this.name = 'WebDatabaseContractAuditTimeoutError'
	}
}

export function normalizeWebDatabaseContractAuditFailure(
	error: unknown,
	findings: string[],
	auditTimedOut: boolean,
	auditTimeoutMilliseconds: number | undefined
): unknown {
	if (error instanceof WebDatabaseContractError) return error
	if (findings.length > 0) return new WebDatabaseContractError(findings)
	if (auditTimedOut && auditTimeoutMilliseconds !== undefined) {
		return new WebDatabaseContractAuditTimeoutError(
			auditTimeoutMilliseconds,
			error
		)
	}
	return error
}

function positiveIntegerOption(
	name: string,
	value: number | undefined
): number | undefined {
	if (value === undefined) return undefined
	if (!Number.isInteger(value) || value <= 0) {
		throw new TypeError(`${name} must be a positive integer`)
	}
	return value
}

function expressionIsTrue(expression: string | null): boolean {
	return expression?.replace(/[()\s]/g, '') === 'true'
}

function compareNames(actual: string[], expected: readonly string[]): boolean {
	return [...actual].sort().join('\n') === [...expected].sort().join('\n')
}

export async function validateWebDatabaseContract(
	connectionString = process.env.DATABASE_URL,
	options: WebDatabaseContractOptions = {}
): Promise<WebDatabaseContractResult> {
	if (!connectionString) {
		throw new WebDatabaseContractError(['DATABASE_URL is not configured'])
	}
	const statementTimeoutMilliseconds = positiveIntegerOption(
		'statementTimeoutMilliseconds',
		options.statementTimeoutMilliseconds
	)
	const auditTimeoutMilliseconds = positiveIntegerOption(
		'auditTimeoutMilliseconds',
		options.auditTimeoutMilliseconds
	)

	const client = postgres(connectionString, {
		max: 1,
		prepare: false,
		connect_timeout: options.connectTimeoutSeconds ?? 10,
		idle_timeout: 5,
		connection:
			statementTimeoutMilliseconds === undefined
				? {}
				: { statement_timeout: statementTimeoutMilliseconds }
	})
	const findings: string[] = []
	let auditTimedOut = false
	const auditTimer =
		auditTimeoutMilliseconds === undefined
			? undefined
			: setTimeout(() => {
					auditTimedOut = true
					void client.end({ timeout: 0 })
				}, auditTimeoutMilliseconds)
	auditTimer?.unref()

	try {
		const [runtimeRole] = await client<RoleAttributes[]>`
			SELECT
				role_row.rolname AS role_name,
				role_row.rolcanlogin,
				role_row.rolsuper,
				role_row.rolcreatedb,
				role_row.rolcreaterole,
				role_row.rolinherit,
				role_row.rolreplication,
				role_row.rolbypassrls
			FROM pg_roles role_row
			WHERE role_row.rolname = current_user
		`
		if (!runtimeRole) {
			findings.push('current PostgreSQL role is missing from pg_roles')
		} else {
			if (!runtimeRole.rolcanlogin)
				findings.push('runtime role is not a LOGIN role')
			if (!runtimeRole.rolinherit)
				findings.push('runtime role does not inherit its capability role')
			if (
				runtimeRole.rolsuper ||
				runtimeRole.rolcreatedb ||
				runtimeRole.rolcreaterole ||
				runtimeRole.rolreplication ||
				runtimeRole.rolbypassrls
			) {
				findings.push(
					`runtime role ${runtimeRole.role_name} has elevated PostgreSQL attributes`
				)
			}
		}

		const [capabilityRole] = await client<RoleAttributes[]>`
			SELECT
				role_row.rolname AS role_name,
				role_row.rolcanlogin,
				role_row.rolsuper,
				role_row.rolcreatedb,
				role_row.rolcreaterole,
				role_row.rolinherit,
				role_row.rolreplication,
				role_row.rolbypassrls
			FROM pg_roles role_row
			WHERE role_row.rolname = ${WEB_AUTH_CAPABILITY_ROLE}
		`
		if (!capabilityRole) {
			findings.push(`${WEB_AUTH_CAPABILITY_ROLE} does not exist`)
		} else if (
			capabilityRole.rolcanlogin ||
			capabilityRole.rolsuper ||
			capabilityRole.rolcreatedb ||
			capabilityRole.rolcreaterole ||
			capabilityRole.rolinherit ||
			capabilityRole.rolreplication ||
			capabilityRole.rolbypassrls
		) {
			findings.push(`${WEB_AUTH_CAPABILITY_ROLE} has unsafe role attributes`)
		}

		const inheritedRoles = await client<Array<{ role_name: string }>>`
			WITH RECURSIVE inherited_roles(role_oid, role_name) AS (
				SELECT granted_role.oid, granted_role.rolname
				FROM pg_auth_members membership
				JOIN pg_roles member_role ON member_role.oid = membership.member
				JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
				WHERE member_role.rolname = current_user
				UNION
				SELECT granted_role.oid, granted_role.rolname
				FROM inherited_roles inherited_role
				JOIN pg_auth_members membership ON membership.member = inherited_role.role_oid
				JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
			)
			SELECT DISTINCT role_name
			FROM inherited_roles
			ORDER BY role_name
		`
		const inheritedRoleNames = inheritedRoles.map(row => row.role_name)
		if (!compareNames(inheritedRoleNames, [WEB_AUTH_CAPABILITY_ROLE])) {
			findings.push(
				`runtime role memberships are ${inheritedRoleNames.join(', ') || 'empty'}`
			)
		}
		if (findings.length > 0) throw new WebDatabaseContractError(findings)

		const [databaseBoundary] = await client<Array<{ can_create: boolean }>>`
			SELECT has_database_privilege(current_user, current_database(), 'CREATE') AS can_create
		`
		if (databaseBoundary?.can_create)
			findings.push('runtime role can create database schemas')

		const [authSchemaBoundary] = await client<
			Array<{ can_use: boolean; can_create: boolean }>
		>`
			SELECT
				has_schema_privilege(current_user, 'bauth', 'USAGE') AS can_use,
				has_schema_privilege(current_user, 'bauth', 'CREATE') AS can_create
		`
		if (!authSchemaBoundary?.can_use)
			findings.push('runtime role cannot use bauth')
		if (authSchemaBoundary?.can_create)
			findings.push('runtime role can create bauth objects')
		if (findings.length > 0) throw new WebDatabaseContractError(findings)

		const authTables = await client<AuthTableBoundary[]>`
			SELECT
				relation.relname AS table_name,
				pg_get_userbyid(relation.relowner) AS owner_name,
				relation.relrowsecurity AS rls_enabled,
				has_table_privilege(current_user, relation.oid, 'SELECT') AS can_select,
				has_table_privilege(current_user, relation.oid, 'INSERT') AS can_insert,
				has_table_privilege(current_user, relation.oid, 'UPDATE') AS can_update,
				has_table_privilege(current_user, relation.oid, 'DELETE') AS can_delete,
				has_table_privilege(current_user, relation.oid, 'TRUNCATE') AS can_truncate,
				has_table_privilege(current_user, relation.oid, 'REFERENCES') AS can_references,
				has_table_privilege(current_user, relation.oid, 'TRIGGER') AS can_trigger
			FROM pg_class relation
			JOIN pg_namespace namespace_row ON namespace_row.oid = relation.relnamespace
			WHERE namespace_row.nspname = 'bauth'
				AND relation.relkind IN ('r', 'p')
				AND relation.relname <> '__drizzle_migrations'
			ORDER BY relation.relname
		`
		const expectedAuthTableNames = new Set<string>(WEB_AUTH_RUNTIME_TABLES)
		const authTableNames = authTables.map(row => row.table_name)
		if (!compareNames(authTableNames, WEB_AUTH_RUNTIME_TABLES)) {
			findings.push(
				`bauth runtime tables are ${authTableNames.join(', ') || 'empty'}`
			)
		}
		for (const table of authTables) {
			const isRuntimeTable = expectedAuthTableNames.has(table.table_name)
			if (table.owner_name === runtimeRole?.role_name) {
				findings.push(`runtime role owns bauth.${table.table_name}`)
			}
			if (!table.rls_enabled)
				findings.push(`bauth.${table.table_name} is missing RLS`)
			if (
				isRuntimeTable &&
				(!table.can_select ||
					!table.can_insert ||
					!table.can_update ||
					!table.can_delete)
			) {
				findings.push(
					`bauth.${table.table_name} is missing required DML privileges`
				)
			}
			if (
				table.can_truncate ||
				table.can_references ||
				table.can_trigger ||
				(!isRuntimeTable &&
					(table.can_select ||
						table.can_insert ||
						table.can_update ||
						table.can_delete))
			) {
				findings.push(`bauth.${table.table_name} has excessive privileges`)
			}
		}

		const authPolicies = await client<AuthPolicyBoundary[]>`
			SELECT
				tablename AS table_name,
				policyname AS policy_name,
				permissive,
				roles::text[] AS roles,
				cmd AS command,
				qual AS using_expression,
				with_check AS check_expression
			FROM pg_policies
			WHERE schemaname = 'bauth'
				AND tablename <> '__drizzle_migrations'
			ORDER BY tablename, policyname
		`
		const expectedGraphqlAuthTableNames = new Set<string>(
			GRAPHQL_AUTH_RUNTIME_TABLES
		)
		let webRuntimePolicyCount = 0
		let graphqlAuthPolicyCount = 0
		for (const policy of authPolicies) {
			const isWebRuntimePolicy =
				expectedAuthTableNames.has(policy.table_name) &&
				policy.policy_name === AUTH_RUNTIME_POLICY &&
				policy.permissive === 'PERMISSIVE' &&
				compareNames(policy.roles, [WEB_AUTH_CAPABILITY_ROLE]) &&
				policy.command === 'ALL' &&
				expressionIsTrue(policy.using_expression) &&
				expressionIsTrue(policy.check_expression)
			const isGraphqlAuthPolicy =
				expectedGraphqlAuthTableNames.has(policy.table_name) &&
				policy.policy_name === GRAPHQL_AUTH_RUNTIME_POLICY &&
				policy.permissive === 'PERMISSIVE' &&
				compareNames(policy.roles, [GRAPHQL_AUTH_CAPABILITY_ROLE]) &&
				policy.command === 'SELECT' &&
				expressionIsTrue(policy.using_expression) &&
				policy.check_expression === null
			if (isWebRuntimePolicy) webRuntimePolicyCount += 1
			if (isGraphqlAuthPolicy) graphqlAuthPolicyCount += 1
			if (!isWebRuntimePolicy && !isGraphqlAuthPolicy) {
				findings.push(
					`bauth.${policy.table_name} has an invalid runtime policy`
				)
			}
		}
		if (webRuntimePolicyCount !== WEB_AUTH_RUNTIME_TABLES.length) {
			findings.push(
				`bauth Web runtime policy count is ${webRuntimePolicyCount}`
			)
		}
		if (graphqlAuthPolicyCount !== GRAPHQL_AUTH_RUNTIME_TABLES.length) {
			findings.push(
				`bauth GraphQL auth policy count is ${graphqlAuthPolicyCount}`
			)
		}

		const [ledgerBoundary] = await client<NamedPrivilegeBoundary[]>`
			SELECT
				'bauth.__drizzle_migrations' AS object_name,
				has_table_privilege(current_user, 'bauth.__drizzle_migrations', 'SELECT') AS can_read,
				(
					has_table_privilege(current_user, 'bauth.__drizzle_migrations', 'INSERT')
					OR has_table_privilege(current_user, 'bauth.__drizzle_migrations', 'UPDATE')
					OR has_table_privilege(current_user, 'bauth.__drizzle_migrations', 'DELETE')
					OR has_table_privilege(current_user, 'bauth.__drizzle_migrations', 'TRUNCATE')
				) AS can_write
		`
		if (ledgerBoundary?.can_read || ledgerBoundary?.can_write) {
			findings.push('runtime role can access the Web migration ledger')
		}

		const dataSchemas = await client<
			Array<{ schema_name: string; can_use: boolean; can_create: boolean }>
		>`
			SELECT
				namespace_row.nspname AS schema_name,
				has_schema_privilege(current_user, namespace_row.oid, 'USAGE') AS can_use,
				has_schema_privilege(current_user, namespace_row.oid, 'CREATE') AS can_create
			FROM pg_namespace namespace_row
			WHERE namespace_row.nspname IN ${client(DATA_SCHEMAS)}
			ORDER BY namespace_row.nspname
		`
		for (const schemaRow of dataSchemas) {
			if (schemaRow.can_use || schemaRow.can_create) {
				findings.push(
					`runtime role can access Data schema ${schemaRow.schema_name}`
				)
			}
		}

		const dataRelations = await client<NamedPrivilegeBoundary[]>`
			SELECT
				format('%I.%I', namespace_row.nspname, relation.relname) AS object_name,
				has_table_privilege(current_user, relation.oid, 'SELECT') AS can_read,
				(
					has_table_privilege(current_user, relation.oid, 'INSERT')
					OR has_table_privilege(current_user, relation.oid, 'UPDATE')
					OR has_table_privilege(current_user, relation.oid, 'DELETE')
					OR has_table_privilege(current_user, relation.oid, 'TRUNCATE')
					OR has_table_privilege(current_user, relation.oid, 'REFERENCES')
					OR has_table_privilege(current_user, relation.oid, 'TRIGGER')
				) AS can_write
			FROM pg_class relation
			JOIN pg_namespace namespace_row ON namespace_row.oid = relation.relnamespace
			WHERE namespace_row.nspname IN ${client([...DATA_SCHEMAS, 'public'])}
				AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
				AND (
					has_table_privilege(current_user, relation.oid, 'SELECT')
					OR has_table_privilege(current_user, relation.oid, 'INSERT')
					OR has_table_privilege(current_user, relation.oid, 'UPDATE')
					OR has_table_privilege(current_user, relation.oid, 'DELETE')
					OR has_table_privilege(current_user, relation.oid, 'TRUNCATE')
					OR has_table_privilege(current_user, relation.oid, 'REFERENCES')
					OR has_table_privilege(current_user, relation.oid, 'TRIGGER')
				)
			ORDER BY object_name
		`
		for (const relation of dataRelations) {
			findings.push(
				`runtime role can ${relation.can_write ? 'write' : 'read'} ${relation.object_name}`
			)
		}

		const dataSequences = await client<Array<{ object_name: string }>>`
			SELECT format('%I.%I', namespace_row.nspname, relation.relname) AS object_name
			FROM pg_class relation
			JOIN pg_namespace namespace_row ON namespace_row.oid = relation.relnamespace
			WHERE namespace_row.nspname IN ${client([...DATA_SCHEMAS, 'public'])}
				AND relation.relkind = 'S'
				AND (
					has_sequence_privilege(current_user, relation.oid, 'USAGE')
					OR has_sequence_privilege(current_user, relation.oid, 'SELECT')
					OR has_sequence_privilege(current_user, relation.oid, 'UPDATE')
				)
			ORDER BY object_name
		`
		for (const sequence of dataSequences) {
			findings.push(`runtime role can access sequence ${sequence.object_name}`)
		}

		const dataFunctions = await client<Array<{ object_name: string }>>`
			SELECT format(
				'%I.%I(%s)',
				namespace_row.nspname,
				function_row.proname,
				pg_get_function_identity_arguments(function_row.oid)
			) AS object_name
			FROM pg_proc function_row
			JOIN pg_namespace namespace_row ON namespace_row.oid = function_row.pronamespace
			WHERE namespace_row.nspname IN ${client(DATA_SCHEMAS)}
				AND has_function_privilege(current_user, function_row.oid, 'EXECUTE')
			ORDER BY object_name
		`
		for (const functionRow of dataFunctions) {
			findings.push(`runtime role can execute ${functionRow.object_name}`)
		}

		if (findings.length > 0) throw new WebDatabaseContractError(findings)

		if (auditTimedOut && auditTimeoutMilliseconds !== undefined) {
			throw new WebDatabaseContractAuditTimeoutError(auditTimeoutMilliseconds)
		}
		return {
			roleName: runtimeRole?.role_name ?? 'unknown',
			capabilityRole: WEB_AUTH_CAPABILITY_ROLE,
			authTables: authTableNames
		}
	} catch (error) {
		throw normalizeWebDatabaseContractAuditFailure(
			error,
			findings,
			auditTimedOut,
			auditTimeoutMilliseconds
		)
	} finally {
		if (auditTimer) clearTimeout(auditTimer)
		await client.end({ timeout: 0 })
	}
}
