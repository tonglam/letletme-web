import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	absoluteAuthUrl,
	onboardingRedirectPath,
	safeRedirectPath
} from '../../lib/auth-redirects'

describe('auth redirect policy', () => {
	it('preserves same-origin paths, queries, and fragments', () => {
		assert.equal(
			safeRedirectPath('/live/points?event=3#captain'),
			'/live/points?event=3#captain'
		)
	})

	it('rejects external, protocol-relative, malformed, and relative targets', () => {
		for (const target of [
			'https://attacker.example',
			'//attacker.example',
			'/\\attacker.example',
			'profile',
			'/profile\nX-Test: injected'
		]) {
			assert.equal(safeRedirectPath(target), '/', target)
		}
	})

	it('carries the safe destination through onboarding', () => {
		assert.equal(
			onboardingRedirectPath('/tournament/42/manage?tab=members'),
			'/onboarding/bind-entry?next=%2Ftournament%2F42%2Fmanage%3Ftab%3Dmembers'
		)
	})

	it('builds absolute Better Auth callback URLs from safe paths', () => {
		assert.equal(
			absoluteAuthUrl('/auth/reset-password', 'https://letletme.top'),
			'https://letletme.top/auth/reset-password'
		)
		assert.equal(
			absoluteAuthUrl('//attacker.example', 'https://letletme.top'),
			'https://letletme.top/'
		)
	})
})
