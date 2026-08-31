import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { shouldResolveGraphQLProxySession } from '../lib/graphql-proxy-session'

describe('GraphQL proxy read path', () => {
	it('skips Better Auth without a browser cookie', () => {
		assert.equal(shouldResolveGraphQLProxySession(new Headers()), false)
		assert.equal(
			shouldResolveGraphQLProxySession(
				new Headers({ authorization: 'Bearer opaque-mini-token' })
			),
			false
		)
		assert.equal(
			shouldResolveGraphQLProxySession(
				new Headers({ cookie: 'better-auth.session_token=value' })
			),
			true
		)
	})

	it('does not use the PostgreSQL limiter in the GraphQL proxy route', () => {
		const route = readFileSync(
			new URL('../app/api/graphql/route.ts', import.meta.url),
			'utf8'
		)
		assert.doesNotMatch(
			route,
			/checkDatabaseRateLimit|databaseRateLimit|graphql-proxy-ip/
		)
		assert.doesNotMatch(route, /from ['"]@\/lib\/http-security['"]/)
		assert.match(route, /await import\(['"]@\/lib\/auth['"]\)/)
		assert.match(route, /buildGraphQLProxyIngress/)
		assert.match(route, /copySafeGraphQLUpstreamHeaders/)
		assert.match(route, /request\.headers\.get\('X-LetLetMe-Contract'\)/)
		assert.match(route, /headers\['X-LetLetMe-Contract'\] = livePointsContract/)
		assert.match(route, /includeRateLimitMetadata: cacheControl === 'no-store'/)
		assert.match(
			route,
			/if \(cacheControl === 'no-store'\) safeHeaders\.set\('X-Request-Id'/
		)
		assert.doesNotMatch(route, /forwardHeaders\[[^\]]*Device-Id/)
	})

	it('attributes public API cache fills to the originating browser identity', () => {
		const server = readFileSync(
			new URL('../lib/graphql-server.ts', import.meta.url),
			'utf8'
		)
		assert.match(server, /new AsyncLocalStorage<PublicRouteIngressContext>/)
		assert.match(
			server,
			/buildOpaqueRateLimitSubject\(request\.headers, secret\)/
		)
		assert.match(server, /trafficClass: 'web_browser'/)
		assert.match(server, /routeIngress \? 'web_browser' : 'web_rsc'/)

		for (const path of [
			'../app/api/live/context/route.ts',
			'../app/api/live/matches/route.ts',
			'../app/api/live/matches/[fixtureId]/players/route.ts',
			'../app/api/fixtures/window/route.ts',
			'../app/api/gameweek/desk/route.ts',
			'../app/api/home/fixtures/route.ts',
			'../app/api/player-stats/desk/route.ts',
			'../app/api/trends/public-desk/route.ts'
		]) {
			const route = readFileSync(new URL(path, import.meta.url), 'utf8')
			assert.match(route, /withPublicRouteGraphQLIngress\(request/)
		}
	})

	it('does not key live context validation only by publication revision', () => {
		const route = readFileSync(
			new URL('../app/api/live/context/route.ts', import.meta.url),
			'utf8'
		)
		assert.match(route, /data\.liveContext\?\.windowState/)
		assert.match(route, /data\.liveContext\?\.anchorEventId/)
		assert.match(route, /data\.coreEventContext\?\.revision/)
	})

	it('logs the effective signed workload for every canonical ingress', () => {
		const route = readFileSync(
			new URL('../app/api/graphql/route.ts', import.meta.url),
			'utf8'
		)
		assert.match(
			route,
			/const effectiveWorkload = ingress\?\.ok \? ingress\.workload : workload/
		)
		assert.match(route, /workload: effectiveWorkload/)
	})

	it('adds trusted server context to direct RSC GraphQL requests', () => {
		const client = readFileSync(
			new URL('../lib/graphql-client.ts', import.meta.url),
			'utf8'
		)
		const server = readFileSync(
			new URL('../lib/graphql-server.ts', import.meta.url),
			'utf8'
		)
		assert.doesNotMatch(
			client,
			/server-user-context|getServerUserContextHeaders/
		)
		assert.doesNotMatch(client, /localhost:3000\/api\/graphql/)
		assert.match(server, /getServerUserContextHeaders/)
		assert.match(server, /buildOpaqueRscSubject\(workload, secret\)/)
		assert.match(server, /buildIngressContextHeadersV2/)
		assert.match(server, /workload: GraphQLWorkload/)
		assert.match(server, /capacityRequestIdForCurrentRun/)
		assert.doesNotMatch(server, /getGraphQLServiceTokenHeaders/)
	})
})
