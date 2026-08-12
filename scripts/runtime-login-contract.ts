import postgres from 'postgres'

import {
	validateWebDatabaseContract,
	WEB_AUTH_CAPABILITY_ROLE,
	WEB_RUNTIME_LOGIN,
	type WebDatabaseContractResult
} from '../lib/db/runtime-contract'
import { loadLocalMigrations } from './migration-audit'

export { WEB_AUTH_CAPABILITY_ROLE as WEB_RUNTIME_CAPABILITY, WEB_RUNTIME_LOGIN }

export const WEB_RUNTIME_BASELINE = '0000_auth_baseline'
const WEB_RUNTIME_PASSWORD_PATTERN = /^[A-Za-z0-9_-]{64}$/

type QueryClient = postgres.Sql | postgres.TransactionSql

type DatabaseTarget = {
	databaseName: string
	hostname: string
	port: number
	projectRef: string | null
}

export function requiredEnvironment(name: string): string {
	const value = process.env[name]?.trim()
	if (!value) throw new Error(`${name} is required`)
	return value
}

export function parseWebRuntimeBootstrapArgs(args: readonly string[]): void {
	if (args.length > 0) {
		throw new Error(
			`Web runtime LOGIN bootstrap does not accept arguments: ${args.join(' ')}`
		)
	}
}

function parsePostgresUrl(value: string, variableName: string): URL {
	let parsed: URL
	try {
		parsed = new URL(value)
	} catch {
		throw new Error(`${variableName} must be a valid PostgreSQL URL`)
	}
	if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
		throw new Error(
			`${variableName} must use the postgres or postgresql scheme`
		)
	}
	return parsed
}

export function assertWebRuntimeDatabaseUrl(
	value: string,
	variableName = 'WEB_RUNTIME_DATABASE_URL'
): { password: string } {
	const parsed = parsePostgresUrl(value, variableName)
	let username: string
	let password: string
	let databaseName: string
	try {
		username = decodeURIComponent(parsed.username)
		password = decodeURIComponent(parsed.password)
		databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
	} catch {
		throw new Error(`${variableName} contains invalid URL encoding`)
	}
	const roleMatches =
		username === WEB_RUNTIME_LOGIN ||
		username.startsWith(`${WEB_RUNTIME_LOGIN}.`)
	if (!parsed.hostname || !roleMatches || !password) {
		throw new Error(
			`${variableName} must include ${WEB_RUNTIME_LOGIN} and its initial password`
		)
	}
	if (!WEB_RUNTIME_PASSWORD_PATTERN.test(password)) {
		throw new Error(
			`${variableName} password must be an exact 64-character base64url secret`
		)
	}
	if (!databaseName) {
		throw new Error(`${variableName} must include a database name`)
	}
	return { password }
}

function parseDatabaseTarget(
	value: string,
	variableName: string
): DatabaseTarget {
	const parsed = parsePostgresUrl(value, variableName)
	let databaseName: string
	let username: string
	try {
		databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
		username = decodeURIComponent(parsed.username)
	} catch {
		throw new Error(`${variableName} contains invalid URL encoding`)
	}
	if (!parsed.hostname || !databaseName) {
		throw new Error(`${variableName} must include a host and database name`)
	}
	const directProject =
		parsed.hostname.match(/^db\.([^.]+)\.supabase\.co$/i)?.[1] ?? null
	const usernameProject = username.includes('.')
		? username.slice(username.lastIndexOf('.') + 1)
		: null
	return {
		databaseName,
		hostname: parsed.hostname.toLowerCase(),
		port: parsed.port ? Number.parseInt(parsed.port, 10) : 5432,
		projectRef: directProject ?? usernameProject
	}
}

export function assertWebRuntimeDatabaseTarget(
	directDatabaseUrl: string,
	runtimeDatabaseUrl: string
): void {
	const direct = parseDatabaseTarget(directDatabaseUrl, 'DIRECT_DATABASE_URL')
	const runtime = parseDatabaseTarget(
		runtimeDatabaseUrl,
		'WEB_RUNTIME_DATABASE_URL'
	)
	if (direct.databaseName !== runtime.databaseName) {
		throw new Error(
			'WEB_RUNTIME_DATABASE_URL must target the same database as DIRECT_DATABASE_URL'
		)
	}
	const sameProject =
		direct.projectRef !== null &&
		runtime.projectRef !== null &&
		direct.projectRef.toLowerCase() === runtime.projectRef.toLowerCase()
	const sameEndpoint =
		direct.hostname === runtime.hostname && direct.port === runtime.port
	if (!sameProject && !sameEndpoint) {
		throw new Error(
			'WEB_RUNTIME_DATABASE_URL must target the same PostgreSQL project as DIRECT_DATABASE_URL'
		)
	}
}

async function assertAuthBaseline(client: QueryClient): Promise<void> {
	const local = await loadLocalMigrations()
	const authBaseline = local.migrations.find(
		migration => migration.tag === WEB_RUNTIME_BASELINE
	)
	if (!authBaseline || local.orphans.length > 0) {
		throw new Error('The exact Web Auth baseline is unavailable')
	}
	const migrationRows = await client<Array<{ hash: string }>>`
		SELECT hash
		FROM bauth.__drizzle_migrations
		WHERE created_at = ${authBaseline.when}
	`
	if (
		migrationRows.length !== 1 ||
		migrationRows[0]?.hash !== authBaseline.hash
	) {
		throw new Error('Web Auth baseline is not applied with the frozen checksum')
	}
}

type CapabilityRow = {
	rolcanlogin: boolean
	rolsuper: boolean
	rolcreatedb: boolean
	rolcreaterole: boolean
	rolinherit: boolean
	rolreplication: boolean
	rolbypassrls: boolean
	role_settings: string[]
}

async function assertCapabilityRole(client: QueryClient): Promise<void> {
	const [capability] = await client<CapabilityRow[]>`
		SELECT
			rolcanlogin,
			rolsuper,
			rolcreatedb,
			rolcreaterole,
			rolinherit,
			rolreplication,
			rolbypassrls,
			COALESCE(rolconfig, ARRAY[]::text[]) AS role_settings
		FROM pg_roles
		WHERE rolname = ${WEB_AUTH_CAPABILITY_ROLE}
	`
	if (
		!capability ||
		capability.rolcanlogin ||
		capability.rolsuper ||
		capability.rolcreatedb ||
		capability.rolcreaterole ||
		capability.rolinherit ||
		capability.rolreplication ||
		capability.rolbypassrls ||
		capability.role_settings.length > 0
	) {
		throw new Error(
			`Web runtime capability ${WEB_AUTH_CAPABILITY_ROLE} is missing or unsafe`
		)
	}
}

async function formattedStatement(
	client: QueryClient,
	operation: 'create' | 'grant',
	password: string
): Promise<string> {
	const [row] =
		operation === 'create'
			? await client<Array<{ statement: string }>>`
					SELECT format(
						'CREATE ROLE %I LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
						${WEB_RUNTIME_LOGIN}::text,
						${password}::text
					) AS statement
				`
			: await client<Array<{ statement: string }>>`
					SELECT format(
						'GRANT %I TO %I',
						${WEB_AUTH_CAPABILITY_ROLE}::text,
						${WEB_RUNTIME_LOGIN}::text
					) AS statement
				`
	if (!row?.statement) {
		throw new Error(`Unable to format Web runtime ${operation} statement`)
	}
	return row.statement
}

export async function verifyWebRuntimeLogin(
	directDatabaseUrl: string
): Promise<WebDatabaseContractResult> {
	const client = postgres(directDatabaseUrl, { max: 1, prepare: false })
	try {
		await assertAuthBaseline(client)
	} finally {
		await client.end()
	}
	return validateWebDatabaseContract(directDatabaseUrl, {
		subjectRole: WEB_RUNTIME_LOGIN,
		connectTimeoutSeconds: 5,
		statementTimeoutMilliseconds: 5_000,
		auditTimeoutMilliseconds: 15_000
	})
}

export async function bootstrapWebRuntimeLogin(
	directDatabaseUrl: string,
	password: string
): Promise<boolean> {
	const client = postgres(directDatabaseUrl, { max: 1, prepare: false })
	try {
		await assertAuthBaseline(client)
		return await client.begin(async transaction => {
			await transaction`SELECT pg_advisory_xact_lock(hashtext(${WEB_RUNTIME_LOGIN}))`
			const [existing] = await transaction<Array<{ exists: boolean }>>`
				SELECT EXISTS(
					SELECT 1 FROM pg_roles WHERE rolname = ${WEB_RUNTIME_LOGIN}
				) AS exists
			`
			if (existing?.exists) return false

			await assertCapabilityRole(transaction)
			await transaction.unsafe(
				await formattedStatement(transaction, 'create', password)
			)
			await transaction.unsafe(
				await formattedStatement(transaction, 'grant', password)
			)
			return true
		})
	} finally {
		await client.end()
	}
}

export type WebRuntimeConnectionVerificationOptions = {
	retryAuthentication: boolean
	retryDelaysMs?: readonly number[]
	wait?: (milliseconds: number) => Promise<void>
}

const DEFAULT_WEB_RUNTIME_CONNECTION_RETRY_DELAYS_MS = [
	0, 1_000, 2_000, 5_000, 10_000, 15_000, 27_000
] as const

function runtimeConnectionErrorText(error: unknown): string {
	if (error instanceof Error) {
		const code = 'code' in error ? String(error.code) : ''
		return `${code} ${error.message}`
	}
	return String(error)
}

export function isRetryableWebRuntimeConnectionFailure(
	error: unknown,
	retryAuthentication: boolean
): boolean {
	const output = runtimeConnectionErrorText(error)
	if (
		/28P01|password authentication failed|invalid authorization specification/i.test(
			output
		)
	) {
		return retryAuthentication
	}
	return /ECIRCUITBREAKER|CONNECT_TIMEOUT|ETIMEDOUT|ECONN(?:RESET|REFUSED|ABORTED)|EHOSTUNREACH|ENETUNREACH|EAI_AGAIN|connection terminated unexpectedly|server closed the connection unexpectedly|cannot connect now|remaining connection slots|timeout expired/i.test(
		output
	)
}

export async function verifyWebRuntimeConnectionWithRetry<T>(
	verify: () => Promise<T>,
	options: WebRuntimeConnectionVerificationOptions
): Promise<T> {
	const retryDelaysMs =
		options.retryDelaysMs ?? DEFAULT_WEB_RUNTIME_CONNECTION_RETRY_DELAYS_MS
	if (
		retryDelaysMs.length === 0 ||
		retryDelaysMs.some(delay => !Number.isInteger(delay) || delay < 0)
	) {
		throw new TypeError(
			'Web runtime connection retry delays must be non-negative and non-empty'
		)
	}
	const wait =
		options.wait ??
		((milliseconds: number) =>
			new Promise(resolve => setTimeout(resolve, milliseconds)))
	let lastError: unknown
	for (const retryDelayMs of retryDelaysMs) {
		if (retryDelayMs > 0) await wait(retryDelayMs)
		try {
			return await verify()
		} catch (error) {
			lastError = error
			if (
				!isRetryableWebRuntimeConnectionFailure(
					error,
					options.retryAuthentication
				)
			) {
				throw error
			}
		}
	}
	throw new Error(
		'Web runtime LOGIN connection did not become ready within 60 seconds',
		{ cause: lastError }
	)
}
