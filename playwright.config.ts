import { defineConfig, devices } from '@playwright/test'

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL
const e2eDatabaseUrl = process.env.E2E_DATABASE_URL?.trim()
if (!e2eDatabaseUrl) {
	throw new Error(
		'E2E_DATABASE_URL is required for Playwright and must point to an isolated test database'
	)
}
try {
	const parsedE2eDatabaseUrl = new URL(e2eDatabaseUrl)
	if (parsedE2eDatabaseUrl.username !== 'letletme_web_runtime') {
		throw new Error('E2E_DATABASE_URL must use the letletme_web_runtime role')
	}
} catch (error) {
	if (
		error instanceof Error &&
		error.message.includes('letletme_web_runtime')
	) {
		throw error
	}
	throw new Error('E2E_DATABASE_URL must be a valid PostgreSQL URL')
}
// Chromium treats localhost as a trustworthy origin, so production-shaped
// __Secure Better Auth cookies remain testable without weakening them.
const localWebPort = process.env.E2E_WEB_PORT ?? '3100'
const localGraphqlPort = process.env.E2E_GRAPHQL_PORT ?? '4100'
const baseURL = externalBaseUrl ?? `http://localhost:${localWebPort}`
const graphqlFixtureURL = `http://127.0.0.1:${localGraphqlPort}`
const graphqlServiceToken =
	'e2e-graphql-service-token-at-least-thirty-two-bytes'
const nextCommand =
	process.env.PLAYWRIGHT_USE_EXISTING_BUILD === '1'
		? `npm run start -- --hostname 127.0.0.1 --port ${localWebPort}`
		: `npm run build && npm run start -- --hostname 127.0.0.1 --port ${localWebPort}`

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
