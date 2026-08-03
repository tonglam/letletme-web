import { defineConfig, devices } from '@playwright/test'

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL
const baseURL = externalBaseUrl ?? 'http://127.0.0.1:3100'

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
					url: 'http://127.0.0.1:4100/health',
					reuseExistingServer: !process.env.CI,
					timeout: 30_000
				},
				{
					// The cache and streaming assertions describe deployed behavior. Next's
					// development server intentionally replaces document cache headers.
					command:
						'npm run build -- --webpack && npm run start -- --hostname 127.0.0.1 --port 3100',
					env: {
						...process.env,
						BACKEND_PROXY_SECRET: 'playwright-backend-proxy-secret-at-least-32-bytes',
						BETTER_AUTH_SECRET: 'playwright-better-auth-secret-at-least-32-bytes',
						GRAPHQL_ENDPOINT: 'http://127.0.0.1:4100/graphql',
						GRAPHQL_SERVICE_TOKEN: 'playwright-graphql-service-token-at-least-32-bytes'
					},
					url: baseURL,
					reuseExistingServer: !process.env.CI,
					timeout: 120_000
				}
			]
})
