/**
 * Tests for the HMAC-signed user-context envelope injected by the GraphQL proxy.
 *
 * The production code in app/api/graphql/route.ts builds:
 *   X-User-Context:     base64url(JSON { uid, eid, iat, exp })
 *   X-User-Context-Sig: HMAC-SHA256(payload, BACKEND_PROXY_SECRET) as base64url
 *
 * These tests exercise the signing logic in isolation and verify the contract
 * the backend must implement to validate incoming requests.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'

// ─── helpers (mirrors the production code in app/api/graphql/route.ts) ────────

function buildEnvelope(
	uid: string,
	eid: number | null,
	secret: string,
	nowSec = Math.floor(Date.now() / 1000),
): { contextHeader: string; sigHeader: string; payload: string; iat: number } {
	const envelope = { uid, eid, iat: nowSec, exp: nowSec + 60 }
	const payload = JSON.stringify(envelope)
	const sig = createHmac('sha256', secret).update(payload).digest('base64url')
	return {
		contextHeader: Buffer.from(payload).toString('base64url'),
		sigHeader: sig,
		payload,
		iat: nowSec,
	}
}

function verifyEnvelope(
	contextHeader: string,
	sigHeader: string,
	secret: string,
	maxAgeSeconds = 60,
): { valid: boolean; uid?: string; eid?: number | null; reason?: string } {
	let payload: string
	let parsed: { uid: string; eid: number | null; iat: number }
	try {
		payload = Buffer.from(contextHeader, 'base64url').toString('utf8')
		parsed = JSON.parse(payload)
	} catch {
		return { valid: false, reason: 'malformed context header' }
	}

	const expectedSig = createHmac('sha256', secret).update(payload).digest('base64url')
	if (sigHeader !== expectedSig) {
		return { valid: false, reason: 'invalid signature' }
	}

	const age = Math.floor(Date.now() / 1000) - parsed.iat
	if (age > maxAgeSeconds) {
		return { valid: false, reason: 'envelope expired' }
	}

	return { valid: true, uid: parsed.uid, eid: parsed.eid }
}

// ─── tests ────────────────────────────────────────────────────────────────────

const SECRET = 'test-backend-proxy-secret'

describe('HMAC envelope — building', () => {
	it('produces a valid base64url context header', () => {
		const { contextHeader } = buildEnvelope('user-1', 12345, SECRET)
		const decoded = JSON.parse(Buffer.from(contextHeader, 'base64url').toString())
		assert.equal(decoded.uid, 'user-1')
		assert.equal(decoded.eid, 12345)
		assert.ok(typeof decoded.iat === 'number')
		assert.ok(typeof decoded.exp === 'number')
		assert.equal(decoded.exp, decoded.iat + 60)
	})

	it('includes null eid when user has not bound an FPL entry', () => {
		const { contextHeader } = buildEnvelope('user-2', null, SECRET)
		const decoded = JSON.parse(Buffer.from(contextHeader, 'base64url').toString())
		assert.equal(decoded.eid, null)
	})

	it('sets iat to approximately now', () => {
		const before = Math.floor(Date.now() / 1000)
		const { iat } = buildEnvelope('user-3', 0, SECRET)
		const after = Math.floor(Date.now() / 1000)
		assert.ok(iat >= before && iat <= after)
	})
})

describe('HMAC envelope — verification', () => {
	it('accepts a valid envelope with correct secret', () => {
		const { contextHeader, sigHeader } = buildEnvelope('user-1', 42, SECRET)
		const result = verifyEnvelope(contextHeader, sigHeader, SECRET)
		assert.equal(result.valid, true)
		assert.equal(result.uid, 'user-1')
		assert.equal(result.eid, 42)
	})

	it('rejects an envelope signed with the wrong secret', () => {
		const { contextHeader, sigHeader } = buildEnvelope('user-1', 42, SECRET)
		const result = verifyEnvelope(contextHeader, sigHeader, 'wrong-secret')
		assert.equal(result.valid, false)
		assert.equal(result.reason, 'invalid signature')
	})

	it('rejects a tampered payload even with the original signature', () => {
		const { sigHeader } = buildEnvelope('user-1', 42, SECRET)
		// craft a different context claiming a different uid
		const tampered = Buffer.from(JSON.stringify({ uid: 'attacker', eid: 42, iat: Math.floor(Date.now() / 1000) })).toString('base64url')
		const result = verifyEnvelope(tampered, sigHeader, SECRET)
		assert.equal(result.valid, false)
	})

	it('rejects an expired envelope (iat older than maxAgeSeconds)', () => {
		const staleIat = Math.floor(Date.now() / 1000) - 120 // 2 minutes ago
		const { contextHeader, sigHeader } = buildEnvelope('user-1', 42, SECRET, staleIat)
		const result = verifyEnvelope(contextHeader, sigHeader, SECRET, 60)
		assert.equal(result.valid, false)
		assert.equal(result.reason, 'envelope expired')
	})

	it('accepts an envelope right at the edge of the replay window', () => {
		const edgeIat = Math.floor(Date.now() / 1000) - 59
		const { contextHeader, sigHeader } = buildEnvelope('user-1', 42, SECRET, edgeIat)
		const result = verifyEnvelope(contextHeader, sigHeader, SECRET, 60)
		assert.equal(result.valid, true)
	})

	it('rejects a malformed context header', () => {
		const result = verifyEnvelope('!!!not-base64url!!!', 'sig', SECRET)
		assert.equal(result.valid, false)
		assert.equal(result.reason, 'malformed context header')
	})
})
