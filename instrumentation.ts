import { resolveWebDatabasePoolMax } from './lib/db/pool-config'
import { WEB_RUNTIME_LOGIN } from './lib/db/runtime-contract'

export type WebRuntimeDatabaseConfiguration = {
	roleName: typeof WEB_RUNTIME_LOGIN
	host: string
	port: number
	database: string
	pooler: boolean
	poolMax: number
}

function parseRuntimeDatabaseUrl(value: string): URL {
	let parsed: URL
	try {
		parsed = new URL(value)
	} catch {
		throw new Error('DATABASE_URL must be a valid PostgreSQL URL')
	}
	if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
		throw new Error('DATABASE_URL must use the postgres or postgresql scheme')
	}
	return parsed
}

function isSupabasePoolerHostname(hostname: string): boolean {
	return /^[^.]+\.pooler\.supabase\.com$/i.test(hostname)
}

/**
 * Startup validation is intentionally static: it proves that the configured
 * URL has the dedicated identity and safe pooler shape without opening a
 * database connection from instrumentation.register().
 */
export function validateWebRuntimeDatabaseConfiguration(
	databaseUrl = process.env.DATABASE_URL,
	poolMaxValue = process.env.DATABASE_POOL_MAX
): WebRuntimeDatabaseConfiguration {
	if (!databaseUrl) throw new Error('DATABASE_URL is not set')
	const parsed = parseRuntimeDatabaseUrl(databaseUrl)
	let username: string
	let password: string
	let database: string
	try {
		username = decodeURIComponent(parsed.username)
		password = decodeURIComponent(parsed.password)
		database = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
	} catch {
		throw new Error('DATABASE_URL contains invalid URL encoding')
	}
	const poolerRoleMatches =
		isSupabasePoolerHostname(parsed.hostname) &&
		username.startsWith(`${WEB_RUNTIME_LOGIN}.`) &&
		username.slice(WEB_RUNTIME_LOGIN.length + 1).length > 0 &&
		!username.slice(WEB_RUNTIME_LOGIN.length + 1).includes('.')
	if (username !== WEB_RUNTIME_LOGIN && !poolerRoleMatches) {
		throw new Error(`DATABASE_URL must use ${WEB_RUNTIME_LOGIN}`)
	}
	if (!password)
		throw new Error('DATABASE_URL must include runtime credentials')
	if (!parsed.hostname || !database) {
		throw new Error('DATABASE_URL must include a host and database name')
	}
	for (const forbiddenParameter of ['options', 'role', 'search_path']) {
		if (parsed.searchParams.has(forbiddenParameter)) {
			throw new Error(
				`DATABASE_URL must not override PostgreSQL ${forbiddenParameter}`
			)
		}
	}
	const pgbouncer = parsed.searchParams.get('pgbouncer')
	if (pgbouncer !== null && pgbouncer !== 'true') {
		throw new Error('DATABASE_URL pgbouncer must be true when configured')
	}
	const port = parsed.port ? Number.parseInt(parsed.port, 10) : 5432
	if (!Number.isInteger(port) || port < 1 || port > 65_535) {
		throw new Error('DATABASE_URL contains an invalid port')
	}
	return {
		roleName: WEB_RUNTIME_LOGIN,
		host: parsed.hostname.toLowerCase(),
		port,
		database,
		pooler:
			port === 6543 ||
			parsed.hostname.toLowerCase().includes('pooler') ||
			pgbouncer === 'true',
		poolMax: resolveWebDatabasePoolMax(poolMaxValue)
	}
}

export function register() {
	if (process.env.NEXT_RUNTIME === 'nodejs') {
		const configuration = validateWebRuntimeDatabaseConfiguration()
		console.info(
			JSON.stringify({
				event: 'web_database_configuration_verified',
				credentialMutated: false,
				...configuration
			})
		)
	}
}
