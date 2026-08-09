import postgres from 'postgres'
import { pathToFileURL } from 'node:url'

import { loadLocalMigrations } from './migration-audit'

export const WEB_RUNTIME_LOGIN = 'letletme_web_runtime'
export const WEB_RUNTIME_CAPABILITY = 'letletme_web_auth'
export const WEB_RUNTIME_MIGRATION = '0008_web_auth_runtime_role'

type RoleAttributes = {
	roleName: string
	canLogin: boolean
	superuser: boolean
	createDatabase: boolean
	createRole: boolean
	inherit: boolean
	replication: boolean
	bypassRls: boolean
	settings: readonly string[]
}

export type WebRuntimeLoginSnapshot = {
	roles: readonly RoleAttributes[]
	memberships: readonly {
		loginRole: string
		grantedRole: string
		adminOption: boolean
	}[]
	ownedObjectCount: number
}

type RoleRow = {
	role_name: string
	rolcanlogin: boolean
	rolsuper: boolean
	rolcreatedb: boolean
	rolcreaterole: boolean
	rolinherit: boolean
	rolreplication: boolean
	rolbypassrls: boolean
	role_settings: string[]
}

type QueryClient = postgres.Sql | postgres.TransactionSql

function requiredEnvironment(name: string): string {
	const value = process.env[name]?.trim()
	if (!value) throw new Error(`${name} is required`)
	return value
}

function requiredPassword(): string {
	const value = requiredEnvironment('V3_WEB_DB_PASSWORD')
	if (!/^[A-Za-z0-9_-]{64}$/.test(value)) {
		throw new Error(
			'V3_WEB_DB_PASSWORD must be an exact 64-character base64url secret'
		)
	}
	return value
}

function hasOwn(value: unknown, key: string): boolean {
	return (
		typeof value === 'object' &&
		value !== null &&
		Object.prototype.hasOwnProperty.call(value, key)
	)
}

function roleAttributes(row: RoleRow): RoleAttributes {
	return {
		roleName: row.role_name,
		canLogin: row.rolcanlogin,
		superuser: row.rolsuper,
		createDatabase: row.rolcreatedb,
		createRole: row.rolcreaterole,
		inherit: row.rolinherit,
		replication: row.rolreplication,
		bypassRls: row.rolbypassrls,
		settings: row.role_settings
	}
}

function isLockedCapability(role: RoleAttributes): boolean {
	return (
		!role.canLogin &&
		!role.superuser &&
		!role.createDatabase &&
		!role.createRole &&
		!role.inherit &&
		!role.replication &&
		!role.bypassRls &&
		role.settings.length === 0
	)
}

function isSafeLogin(role: RoleAttributes): boolean {
	return (
		role.canLogin &&
		!role.superuser &&
		!role.createDatabase &&
		!role.createRole &&
		role.inherit &&
		!role.replication &&
		!role.bypassRls &&
		role.settings.length === 0
	)
}

export function assertWebRuntimeLoginSnapshot(
	snapshot: WebRuntimeLoginSnapshot
): void {
	if (
		snapshot.roles.length !== 2 ||
		!snapshot.roles.some(role => role.roleName === WEB_RUNTIME_LOGIN) ||
		!snapshot.roles.some(role => role.roleName === WEB_RUNTIME_CAPABILITY)
	) {
		throw new Error('Web runtime provisioning returned an unexpected role set')
	}

	const capability = snapshot.roles.find(
		role => role.roleName === WEB_RUNTIME_CAPABILITY
	)
	if (!capability || !isLockedCapability(capability)) {
		throw new Error(
			`Web runtime capability ${WEB_RUNTIME_CAPABILITY} is missing or unsafe`
		)
	}
	const login = snapshot.roles.find(role => role.roleName === WEB_RUNTIME_LOGIN)
	if (!login || !isSafeLogin(login)) {
		throw new Error(
			`Web runtime LOGIN ${WEB_RUNTIME_LOGIN} is missing or unsafe`
		)
	}
	if (
		snapshot.memberships.length !== 1 ||
		snapshot.memberships[0]?.loginRole !== WEB_RUNTIME_LOGIN ||
		snapshot.memberships[0].grantedRole !== WEB_RUNTIME_CAPABILITY ||
		snapshot.memberships[0].adminOption
	) {
		throw new Error(
			`Web runtime LOGIN must inherit only ${WEB_RUNTIME_CAPABILITY}`
		)
	}
	if (snapshot.ownedObjectCount !== 0) {
		throw new Error('Web runtime LOGIN must not own database objects')
	}
}

async function inspectRuntime(
	client: QueryClient
): Promise<WebRuntimeLoginSnapshot> {
	const roleRows = await client<RoleRow[]>`
		SELECT
			rolname AS role_name,
			rolcanlogin,
			rolsuper,
			rolcreatedb,
			rolcreaterole,
			rolinherit,
			rolreplication,
			rolbypassrls,
			COALESCE(rolconfig, ARRAY[]::text[]) AS role_settings
		FROM pg_roles
		WHERE rolname = ANY(${[WEB_RUNTIME_LOGIN, WEB_RUNTIME_CAPABILITY]}::text[])
		ORDER BY rolname
	`
	const membershipRows = await client<
		Array<{ login_role: string; granted_role: string; admin_option: boolean }>
	>`
		WITH RECURSIVE inherited(login_role, role_oid, granted_role, admin_option, path) AS (
			SELECT
				member_role.rolname,
				granted_role.oid,
				granted_role.rolname,
				membership.admin_option,
				ARRAY[member_role.oid, granted_role.oid]
			FROM pg_auth_members membership
			JOIN pg_roles member_role ON member_role.oid = membership.member
			JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
			WHERE member_role.rolname = ${WEB_RUNTIME_LOGIN}

			UNION ALL

			SELECT
				inherited.login_role,
				granted_role.oid,
				granted_role.rolname,
				membership.admin_option,
				inherited.path || granted_role.oid
			FROM inherited
			JOIN pg_auth_members membership ON membership.member = inherited.role_oid
			JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
			WHERE NOT granted_role.oid = ANY(inherited.path)
		)
		SELECT login_role, granted_role, bool_or(admin_option) AS admin_option
		FROM inherited
		GROUP BY login_role, granted_role
		ORDER BY login_role, granted_role
	`
	const [ownership] = await client<Array<{ owned_object_count: number }>>`
		WITH runtime_role AS (
			SELECT oid FROM pg_roles WHERE rolname = ${WEB_RUNTIME_LOGIN}
		), owned_objects AS (
			SELECT relation.oid
			FROM pg_class relation, runtime_role
			WHERE relation.relowner = runtime_role.oid

			UNION ALL

			SELECT namespace_row.oid
			FROM pg_namespace namespace_row, runtime_role
			WHERE namespace_row.nspowner = runtime_role.oid

			UNION ALL

			SELECT function_row.oid
			FROM pg_proc function_row, runtime_role
			WHERE function_row.proowner = runtime_role.oid

			UNION ALL

			SELECT type_row.oid
			FROM pg_type type_row, runtime_role
			WHERE type_row.typowner = runtime_role.oid

			UNION ALL

			SELECT database_row.oid
			FROM pg_database database_row, runtime_role
			WHERE database_row.datdba = runtime_role.oid
		)
		SELECT count(*)::integer AS owned_object_count FROM owned_objects
	`

	return {
		roles: roleRows.map(roleAttributes),
		memberships: membershipRows.map(row => ({
			loginRole: row.login_role,
			grantedRole: row.granted_role,
			adminOption: row.admin_option
		})),
		ownedObjectCount: ownership?.owned_object_count ?? 0
	}
}

async function formattedStatement(
	client: QueryClient,
	operation: 'create' | 'password' | 'grant',
	value: string
): Promise<string> {
	const [row] =
		operation === 'create'
			? await client<Array<{ statement: string }>>`
			SELECT format(
				'CREATE ROLE %I LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
				${WEB_RUNTIME_LOGIN}::text,
				${value}::text
			) AS statement
		`
			: operation === 'password'
				? await client<Array<{ statement: string }>>`
				SELECT format(
					'ALTER ROLE %I PASSWORD %L',
					${WEB_RUNTIME_LOGIN}::text,
					${value}::text
				) AS statement
			`
				: await client<Array<{ statement: string }>>`
				SELECT format(
					'GRANT %I TO %I',
					${WEB_RUNTIME_CAPABILITY}::text,
					${WEB_RUNTIME_LOGIN}::text
				) AS statement
			`
	if (!row?.statement)
		throw new Error(`Unable to format Web runtime ${operation} statement`)
	return row.statement
}

async function main(): Promise<void> {
	const databaseUrl = requiredEnvironment('DIRECT_DATABASE_URL')
	const runId = requiredEnvironment('CUTOVER_RUN_ID')
	if (!/^v3-\d{8}T\d{6}Z-[0-9a-f]{7,12}$/.test(runId)) {
		throw new Error('CUTOVER_RUN_ID is invalid')
	}
	if (process.env.V3_CUTOVER_APPROVAL !== `APPROVE_V3_ACTIVATION ${runId}`) {
		throw new Error(
			'Exact v3 activation approval is required for Web runtime provisioning'
		)
	}
	const password = requiredPassword()
	const local = await loadLocalMigrations()
	const runtimeMigration = local.migrations.find(
		migration => migration.tag === WEB_RUNTIME_MIGRATION
	)
	if (!runtimeMigration || local.orphans.length > 0) {
		throw new Error('The exact Web runtime migration is unavailable')
	}

	const client = postgres(databaseUrl, { max: 1, prepare: false })
	try {
		const runRows = await client<Array<{ status: string; metadata: unknown }>>`
			SELECT status, metadata
			FROM ops.migration_runs
			WHERE run_id = ${runId}
		`
		const run = runRows[0]
		if (
			runRows.length !== 1 ||
			run?.status !== 'activated' ||
			hasOwn(run.metadata, 'legacyDropPhase')
		) {
			throw new Error(
				'Web runtime provisioning requires the exact activated pre-cleanup run'
			)
		}

		const migrationRows = await client<Array<{ hash: string }>>`
			SELECT hash
			FROM bauth.__drizzle_migrations
			WHERE created_at = ${runtimeMigration.when}
		`
		if (
			migrationRows.length !== 1 ||
			migrationRows[0]?.hash !== runtimeMigration.hash
		) {
			throw new Error(
				'Web runtime migration is not applied with the frozen checksum'
			)
		}

		await client.begin(async transaction => {
			const before = await inspectRuntime(transaction)
			const capability = before.roles.find(
				role => role.roleName === WEB_RUNTIME_CAPABILITY
			)
			if (!capability || !isLockedCapability(capability)) {
				throw new Error(
					`Web runtime capability ${WEB_RUNTIME_CAPABILITY} is missing or unsafe`
				)
			}
			const login = before.roles.find(
				role => role.roleName === WEB_RUNTIME_LOGIN
			)
			if (login && !isSafeLogin(login)) {
				throw new Error(
					`Existing Web runtime LOGIN ${WEB_RUNTIME_LOGIN} has unsafe attributes`
				)
			}
			if (
				before.memberships.some(
					membership =>
						membership.grantedRole !== WEB_RUNTIME_CAPABILITY ||
						membership.adminOption
				)
			) {
				throw new Error(
					`Existing Web runtime LOGIN ${WEB_RUNTIME_LOGIN} has unsafe memberships`
				)
			}
			if (before.ownedObjectCount !== 0) {
				throw new Error(
					`Existing Web runtime LOGIN ${WEB_RUNTIME_LOGIN} owns database objects`
				)
			}

			await transaction.unsafe(
				await formattedStatement(
					transaction,
					login ? 'password' : 'create',
					password
				)
			)
			if (before.memberships.length === 0) {
				await transaction.unsafe(
					await formattedStatement(transaction, 'grant', '')
				)
			}
			assertWebRuntimeLoginSnapshot(await inspectRuntime(transaction))
		})

		const verified = await inspectRuntime(client)
		assertWebRuntimeLoginSnapshot(verified)
		console.log(
			JSON.stringify(
				{
					operation: 'provision-v3-web-runtime-login',
					runId,
					roles: verified.roles,
					memberships: verified.memberships,
					ownedObjectCount: verified.ownedObjectCount
				},
				null,
				2
			)
		)
	} finally {
		await client.end()
	}
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	void main().catch(error => {
		console.error('[provision-runtime-login] failed', error)
		process.exitCode = 1
	})
}
