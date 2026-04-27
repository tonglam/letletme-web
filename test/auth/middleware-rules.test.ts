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

// ─── extracted logic (mirrors middleware.ts) ──────────────────────────────────

// Mirrors the actual middleware.ts logic exactly
const PROTECTED_PREFIXES = [
	'/profile',
	'/tournament/create',
	'/onboarding',
	'/live/tournament',
	'/data/selections',
	'/stats/team',
	'/stats/tournament',
	'/tournament/list',
]

const EXACT_PROTECTED = ['/live/points']

const PROTECTED_API_PREFIXES = ['/api/tournaments']

const ENTRY_GATED_PREFIXES = [
	'/live/points',   // exact only — /live/points/[id] is public
	'/live/tournament',
	'/data/selections',
	'/stats/team',
	'/stats/tournament',
	'/tournament/list',
]

function isProtected(pathname: string): boolean {
	if (EXACT_PROTECTED.some(p => pathname === p)) return true
	return (
		PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/')) ||
		PROTECTED_API_PREFIXES.some(p => pathname.startsWith(p))
	)
}

function requiresAuth(pathname: string): boolean {
	if (pathname.match(/^\/tournament\/[^/]+\/manage(\/|$)/)) return true
	return isProtected(pathname)
}

function requiresEntryId(pathname: string): boolean {
	// /live/points exact is entry-gated; /live/points/[id] is public
	if (pathname === '/live/points') return true
	return ENTRY_GATED_PREFIXES.filter(p => p !== '/live/points')
		.some(p => pathname === p || pathname.startsWith(p + '/'))
}

type MockSession = { user: { fplEntryId: number | null } } | null

function resolveMiddlewareOutcome(
	pathname: string,
	session: MockSession,
): 'pass' | { redirect: string } {
	if (!requiresAuth(pathname)) return 'pass'
	if (!session) return { redirect: `/auth/login?next=${encodeURIComponent(pathname)}` }
	if (!session.user.fplEntryId && requiresEntryId(pathname)) {
		return { redirect: '/onboarding/bind-entry' }
	}
	return 'pass'
}

// ─── tests ────────────────────────────────────────────────────────────────────

const withEntry: MockSession = { user: { fplEntryId: 15702 } }
const withoutEntry: MockSession = { user: { fplEntryId: null } }
const noSession: MockSession = null

describe('middleware — public routes', () => {
	const publicPaths = [
		'/',
		'/live/matches',
		'/live/points/123',       // public id-suffixed variant
		'/data/player-stats',
		'/data/price-changes',
		'/stats/gameweek',
		'/tournament/abc',        // public read-only tournament page
		'/auth/login',
		'/auth/signup',
		'/api/auth/session',
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
		'/tournament/create',
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
		'/live/tournament',
		'/data/selections',
		'/stats/team',
		'/stats/tournament',
		'/tournament/list',
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
		const result = resolveMiddlewareOutcome('/stats/team', noSession)
		assert.ok(typeof result === 'object')
		assert.ok(result.redirect.includes('next=%2Fstats%2Fteam'))
	})
})
