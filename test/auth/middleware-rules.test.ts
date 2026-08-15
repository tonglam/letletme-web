/**
 * Tests for the proxy route-protection rules.
 *
 * The proxy in proxy.ts enforces:
 *   1. Session required for protected routes → redirect to /auth/login?next=<path>
 *   2. fplEntryId required for entry-gated routes → redirect to /onboarding/bind-entry
 *   3. Public routes pass through with no session
 *
 * We extract the pure route-classification logic here so it can be unit-tested
 * without spinning up Next.js or a real auth server.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
	hasInvalidTournamentId,
	isProtectedApi,
	isProtectedPage,
	requiresVerifiedEntry
} from '../../lib/route-protection'

type MockSession = {
	user: { fplEntryId: number | null; fplEntryVerifiedAt: string | null }
} | null

function resolveMiddlewareOutcome(
	pathname: string,
	session: MockSession,
): 'pass' | { redirect: string } {
	if (!isProtectedPage(pathname) && !isProtectedApi(pathname)) return 'pass'
	if (!session) return { redirect: `/auth/login?next=${encodeURIComponent(pathname)}` }
	if (!session.user.fplEntryVerifiedAt && requiresVerifiedEntry(pathname)) {
		return { redirect: '/onboarding/bind-entry' }
	}
	return 'pass'
}

// ─── tests ────────────────────────────────────────────────────────────────────

const withEntry: MockSession = {
	user: { fplEntryId: 15702, fplEntryVerifiedAt: '2026-07-18T00:00:00Z' },
}
const withoutEntry: MockSession = {
	user: { fplEntryId: 15702, fplEntryVerifiedAt: null },
}
const noSession: MockSession = null

describe('middleware — tournament route shape', () => {
	it('rejects special route names when followed by /manage', () => {
		assert.equal(hasInvalidTournamentId('/competitions/create/manage'), true)
		assert.equal(hasInvalidTournamentId('/competitions/browse/manage/'), true)
	})

	it('allows canonical special routes and numeric management routes', () => {
		assert.equal(hasInvalidTournamentId('/competitions/create'), false)
		assert.equal(hasInvalidTournamentId('/competitions/browse/'), false)
		assert.equal(hasInvalidTournamentId('/competitions/42/manage'), false)
	})

	it('rejects tournament ids outside the JavaScript safe integer range', () => {
		assert.equal(
			hasInvalidTournamentId('/competitions/9007199254740992'),
			true
		)
		assert.equal(
			hasInvalidTournamentId('/competitions/9007199254740992/manage'),
			true
		)
	})
})

describe('middleware — public routes', () => {
	const publicPaths = [
		'/',
		'/live/matches',
		'/live/points/123',       // public id-suffixed variant
		'/explore/player-stats',
		'/explore/market',
		'/explore/gameweek',
		'/explore/selections',
		'/competitions/abc',        // public read-only tournament page
		'/auth/login',
		'/auth/signup',
		'/api/auth/session',
		'/api/market/players',
		'/api/market/price-history',
		'/api/market/availability',
	]

	for (const path of publicPaths) {
		it(`passes unauthenticated request to ${path}`, () => {
			assert.equal(resolveMiddlewareOutcome(path, noSession), 'pass')
		})
	}
})

describe('middleware — session gate', () => {
	const sessionGatedPaths = [
		'/profile',
		'/competitions/create',
		'/onboarding/bind-entry',
		'/api/tournaments',
	]

	for (const path of sessionGatedPaths) {
		it(`redirects to login when unauthenticated: ${path}`, () => {
			const result = resolveMiddlewareOutcome(path, noSession)
			assert.notEqual(result, 'pass')
			assert.ok(typeof result === 'object' && result.redirect.startsWith('/auth/login'))
		})

		it(`passes authenticated user (with entry) through: ${path}`, () => {
			assert.equal(resolveMiddlewareOutcome(path, withEntry), 'pass')
		})
	}
})

describe('middleware — fplEntryId gate', () => {
	const entryGatedPaths = [
		'/live/points',
		'/live/competitions',
		'/my-fpl/team',
		'/my-fpl/competitions',
		'/competitions/create',
		'/competitions/browse',
	]

	for (const path of entryGatedPaths) {
		it(`redirects to onboarding when session has no fplEntryId: ${path}`, () => {
			const result = resolveMiddlewareOutcome(path, withoutEntry)
			assert.notEqual(result, 'pass')
			assert.ok(typeof result === 'object' && result.redirect === '/onboarding/bind-entry')
		})

		it(`passes when session has fplEntryId: ${path}`, () => {
			assert.equal(resolveMiddlewareOutcome(path, withEntry), 'pass')
		})

		it(`redirects to login (not onboarding) when no session: ${path}`, () => {
			const result = resolveMiddlewareOutcome(path, noSession)
			assert.ok(typeof result === 'object' && result.redirect.startsWith('/auth/login'))
		})
	}
})

describe('middleware — login redirect encodes next param', () => {
	it('preserves the original path in the next query param', () => {
		const result = resolveMiddlewareOutcome('/my-fpl/team', noSession)
		assert.ok(typeof result === 'object')
		assert.ok(result.redirect.includes('next=%2Fmy-fpl%2Fteam'))
	})
})
