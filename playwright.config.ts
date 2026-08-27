import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

function readLocalEnvValue(filename: string, key: string): string | undefined {
	const p = path.join(process.cwd(), filename)
	if (!existsSync(p)) return undefined
	const line = readFileSync(p, 'utf8')
		.split('\n')
		.find(value => value.trimStart().startsWith(`${key}=`))
	if (!line) return undefined
	let value = line.slice(line.indexOf('=') + 1).trim()
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		value = value.slice(1, -1)
	}
	return value
}

function hydrateE2eEnvFromLocalFile(): void {
	const p = path.join(process.cwd(), '.env.e2e.local')
	if (!existsSync(p)) return
	const text = readFileSync(p, 'utf8')
	for (let line of text.split('\n')) {
		line = line.trimEnd()
		if (line.startsWith('#') || !line.includes('=')) continue
		const ix = line.indexOf('=')
		const key = line.slice(0, ix).trim()
		if (key !== 'E2E_DATABASE_URL' && key !== 'E2E_DIRECT_DATABASE_URL') {
			continue
		}
		let value = line.slice(ix + 1).trim()
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1)
		}
		if (!process.env[key]) process.env[key] = value
	}

	const e2eDatabaseUrl = process.env.E2E_DATABASE_URL
	if (!e2eDatabaseUrl) return
	try {
		const e2eUrl = new URL(e2eDatabaseUrl)
		if (e2eUrl.password) return
		const localRuntimeUrl = readLocalEnvValue(
			'.env.development.local',
			'DATABASE_URL'
		)
		if (!localRuntimeUrl) return
		const configuredUrl = new URL(localRuntimeUrl)
		if (
			configuredUrl.username !== 'letletme_web_runtime' ||
			!configuredUrl.password ||
			configuredUrl.hostname !== e2eUrl.hostname ||
			(configuredUrl.port || '5432') !== (e2eUrl.port || '5432')
		) {
			return
		}
		e2eUrl.username = configuredUrl.username
		e2eUrl.password = configuredUrl.password
		e2eUrl.search = configuredUrl.search
		process.env.E2E_DATABASE_URL = e2eUrl.toString()
	} catch {
		// The normal validation below reports malformed URLs with the variable name.
	}
}

hydrateE2eEnvFromLocalFile()

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL
const e2eDatabaseUrl = process.env.E2E_DATABASE_URL?.trim()
if (!e2eDatabaseUrl) {
	throw new Error(
		'E2E_DATABASE_URL is required for Playwright and must point to an isolated test database'
	)
}
const e2eDirectDatabaseUrl = process.env.E2E_DIRECT_DATABASE_URL?.trim()
if (!e2eDirectDatabaseUrl) {
	throw new Error(
		'E2E_DIRECT_DATABASE_URL is required for Playwright fixtures and must target the same isolated database as E2E_DATABASE_URL'
	)
}

function parseDatabaseTarget(value: string, variableName: string) {
	try {
		const parsed = new URL(value)
		if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
			throw new Error(`${variableName} must be a PostgreSQL URL`)
		}
		const database = decodeURIComponent(parsed.pathname.slice(1))
		if (!parsed.hostname || !database) {
			throw new Error(`${variableName} must include a database name`)
		}
		return {
			host: parsed.hostname.toLowerCase(),
			port: parsed.port || '5432',
			database
		}
	} catch (error) {
		if (error instanceof Error && error.message.startsWith(variableName)) {
			throw error
		}
		throw new Error(`${variableName} must be a valid PostgreSQL URL`)
	}
}

const e2eDatabaseTarget = parseDatabaseTarget(
	e2eDatabaseUrl,
	'E2E_DATABASE_URL'
)
try {
	const parsedE2eDatabaseUrl = new URL(e2eDatabaseUrl)
	if (
		decodeURIComponent(parsedE2eDatabaseUrl.username) !== 'letletme_web_runtime'
	) {
		throw new Error('E2E_DATABASE_URL must use the letletme_web_runtime role')
	}
} catch (error) {
	if (
		error instanceof Error &&
		(error.message.includes('letletme_web_runtime') ||
			error.message.includes('valid PostgreSQL URL'))
	) {
		throw error
	}
	throw new Error('E2E_DATABASE_URL must be a valid PostgreSQL URL')
}
const e2eDirectDatabaseTarget = parseDatabaseTarget(
	e2eDirectDatabaseUrl,
	'E2E_DIRECT_DATABASE_URL'
)
if (
	e2eDirectDatabaseTarget.host !== e2eDatabaseTarget.host ||
	e2eDirectDatabaseTarget.port !== e2eDatabaseTarget.port ||
	e2eDirectDatabaseTarget.database !== e2eDatabaseTarget.database
) {
	throw new Error(
		'E2E_DIRECT_DATABASE_URL must target the same host, port, and database as E2E_DATABASE_URL'
	)
}
// Chromium treats localhost as a trustworthy origin, so production-shaped
// __Secure Better Auth cookies remain testable without weakening them.
const localWebPort = process.env.E2E_WEB_PORT ?? '3100'
const localGraphqlPort = process.env.E2E_GRAPHQL_PORT ?? '4100'
const baseURL = externalBaseUrl ?? `http://localhost:${localWebPort}`
const graphqlFixtureURL = `http://127.0.0.1:${localGraphqlPort}`
const graphqlServiceToken =
	'e2e-graphql-service-token-at-least-thirty-two-bytes'
const standaloneServerCommand =
	'mkdir -p .next/standalone/public .next/standalone/.next/static && cp -R public/. .next/standalone/public/ && cp -R .next/static/. .next/standalone/.next/static/ && node .next/standalone/server.js'
const nextCommand =
	process.env.PLAYWRIGHT_USE_EXISTING_BUILD === '1'
		? standaloneServerCommand
		: `npm run build && ${standaloneServerCommand}`

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 2 : undefined,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: externalBaseUrl
		? undefined
		: [
				{
					command: 'node e2e/fixtures/live-graphql-server.mjs',
					url: `${graphqlFixtureURL}/health`,
					reuseExistingServer: false,
					timeout: 30_000,
					env: {
						...process.env,
						E2E_GRAPHQL_PORT: localGraphqlPort,
						GRAPHQL_SERVICE_TOKEN: graphqlServiceToken
					}
				},
				{
					command: nextCommand,
					env: {
						...process.env,
						NODE_ENV: 'production',
						TZ: 'UTC',
						HOSTNAME: '127.0.0.1',
						PORT: localWebPort,
						BETTER_AUTH_URL: baseURL,
						BACKEND_PROXY_SECRET:
							'playwright-backend-proxy-secret-at-least-32-bytes',
						BETTER_AUTH_SECRET:
							'playwright-better-auth-secret-at-least-32-bytes',
						E2E_DATABASE_URL: e2eDatabaseUrl,
						DATABASE_URL: e2eDatabaseUrl,
						GRAPHQL_ENDPOINT: `${graphqlFixtureURL}/graphql`,
						GRAPHQL_SERVICE_TOKEN: graphqlServiceToken
					},
					url: `${baseURL}/icon.svg`,
					reuseExistingServer: false,
					timeout: 180_000
				}
			]
})
