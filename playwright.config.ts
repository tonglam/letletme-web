import { defineConfig, devices } from '@playwright/test'

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL
const baseURL = externalBaseUrl ?? 'http://127.0.0.1:3100'
const graphqlFixtureURL = 'http://127.0.0.1:4100'
const graphqlServiceToken =
	'e2e-graphql-service-token-at-least-thirty-two-bytes'
const nextCommand =
	process.env.PLAYWRIGHT_USE_EXISTING_BUILD === '1'
		? 'npm run start -- --hostname 127.0.0.1 --port 3100'
		: 'npm run build && npm run start -- --hostname 127.0.0.1 --port 3100'

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
						E2E_GRAPHQL_PORT: '4100',
						GRAPHQL_SERVICE_TOKEN: graphqlServiceToken
					}
				},
				{
					command: nextCommand,
					env: {
						...process.env,
						NODE_ENV: 'production',
						BETTER_AUTH_URL: baseURL,
						BACKEND_PROXY_SECRET:
							'playwright-backend-proxy-secret-at-least-32-bytes',
						BETTER_AUTH_SECRET:
							'playwright-better-auth-secret-at-least-32-bytes',
						GRAPHQL_ENDPOINT: `${graphqlFixtureURL}/graphql`,
						GRAPHQL_SERVICE_TOKEN: graphqlServiceToken
					},
					url: baseURL,
					reuseExistingServer: false,
					timeout: 180_000
				}
			]
})
