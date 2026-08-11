import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { shouldResolveGraphQLProxySession } from '../lib/graphql-proxy-session'

describe('GraphQL proxy read path', () => {
	it('skips Better Auth without a browser cookie', () => {
		assert.equal(shouldResolveGraphQLProxySession(new Headers()), false)
		assert.equal(
			shouldResolveGraphQLProxySession(new Headers({ authorization: 'Bearer opaque-mini-token' })),
			false,
		)
		assert.equal(
			shouldResolveGraphQLProxySession(new Headers({ cookie: 'better-auth.session_token=value' })),
			true,
		)
	})

	it('does not use the PostgreSQL limiter in the GraphQL proxy route', () => {
		const route = readFileSync(new URL('../app/api/graphql/route.ts', import.meta.url), 'utf8')
		assert.doesNotMatch(route, /checkDatabaseRateLimit|databaseRateLimit|graphql-proxy-ip/)
		assert.doesNotMatch(route, /from ['"]@\/lib\/http-security['"]/)
		assert.match(route, /await import\(['"]@\/lib\/auth['"]\)/)
		assert.match(route, /buildIngressContextHeaders\(subject, secret\)/)
	})

	it('adds trusted server context to direct RSC GraphQL requests', () => {
		const client = readFileSync(new URL('../lib/graphql-client.ts', import.meta.url), 'utf8')
		const server = readFileSync(new URL('../lib/graphql-server.ts', import.meta.url), 'utf8')
		assert.doesNotMatch(client, /server-user-context|getServerUserContextHeaders/)
		assert.doesNotMatch(client, /localhost:3000\/api\/graphql/)
		assert.match(server, /getServerUserContextHeaders/)
		assert.match(server, /rate-limit:web-public-rsc/)
		assert.match(server, /buildIngressContextHeaders/)
		assert.doesNotMatch(server, /getGraphQLServiceTokenHeaders/)
	})
})
