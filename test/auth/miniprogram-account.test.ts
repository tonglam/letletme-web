import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
	MiniProgramAuthError,
	assertValidWeChatLoginCode,
	assertValidDeviceId,
	getBearerToken,
	hashMiniProgramChallenge,
	hashMiniProgramSecret,
	isExpired,
	normalizeEmail,
	normalizeWeChatOpenId,
} from '../../lib/miniprogram-account-core'

describe('mini program account email normalization', () => {
	it('normalizes valid email addresses', () => {
		assert.equal(normalizeEmail('  Tong@LetLetMe.Top '), 'tong@letletme.top')
	})

	it('rejects invalid email addresses', () => {
		assert.throws(
			() => normalizeEmail('not-an-email'),
			(error) => error instanceof MiniProgramAuthError && error.status === 400,
		)
	})
})

describe('mini program account device validation', () => {
	it('accepts a stable device id', () => {
		assert.equal(assertValidDeviceId('wx-device-1234567890'), 'wx-device-1234567890')
	})

	it('rejects missing or short device ids', () => {
		assert.throws(
			() => assertValidDeviceId('short'),
			(error) => error instanceof MiniProgramAuthError && error.status === 400,
		)
	})
})

describe('mini program WeChat identity validation', () => {
	it('accepts normal WeChat login codes and open ids', () => {
		assert.equal(assertValidWeChatLoginCode('  061234abcd_OPENID_LOGIN_CODE  '), '061234abcd_OPENID_LOGIN_CODE')
		assert.equal(normalizeWeChatOpenId('  o6_bmjrPTlm6_2sgVt7hMZOPfL2M  '), 'o6_bmjrPTlm6_2sgVt7hMZOPfL2M')
	})

	it('rejects missing or malformed WeChat identity values', () => {
		assert.throws(
			() => assertValidWeChatLoginCode('short'),
			(error) => error instanceof MiniProgramAuthError && error.status === 400,
		)
		assert.throws(
			() => normalizeWeChatOpenId('openid with spaces'),
			(error) => error instanceof MiniProgramAuthError && error.status === 400,
		)
	})
})

describe('mini program account secret handling', () => {
	it('hashes secrets without returning the raw value', () => {
		const hash = hashMiniProgramSecret('123456')

		assert.notEqual(hash, '123456')
		assert.match(hash, /^[a-f0-9]{64}$/)
		assert.equal(hashMiniProgramSecret('123456'), hash)
	})

	it('uses a keyed hash for low-entropy email challenges', () => {
		const first = hashMiniProgramChallenge('123456', 'pepper-a')
		const second = hashMiniProgramChallenge('123456', 'pepper-b')

		assert.match(first, /^[a-f0-9]{64}$/)
		assert.notEqual(first, second)
		assert.equal(first, hashMiniProgramChallenge('123456', 'pepper-a'))
	})

	it('extracts bearer tokens case-insensitively', () => {
		assert.equal(getBearerToken('Bearer token-1'), 'token-1')
		assert.equal(getBearerToken('bearer token-2'), 'token-2')
		assert.equal(getBearerToken('token-3'), null)
		assert.equal(getBearerToken(null), null)
	})
})

describe('mini program account expiry handling', () => {
	it('detects expired timestamps', () => {
		const now = new Date('2026-04-30T00:00:00Z')

		assert.equal(isExpired(new Date('2026-04-29T23:59:59Z'), now), true)
		assert.equal(isExpired(new Date('2026-04-30T00:00:01Z'), now), false)
	})
})
