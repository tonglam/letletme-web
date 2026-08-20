import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import { describe, it } from 'node:test'

import {
	buildPrivateBugReportLocator,
	parseLegacyBugReportLocator,
	verifyBugReportStorageEnvelope
} from '../lib/bug-report-storage-contract'

describe('bug-report storage internal endpoint contract', () => {
	it('verifies the Data HMAC envelope and rejects body tampering', () => {
		const secret = 's'.repeat(64)
		const timestamp = String(Date.now())
		const nonce = '550e8400-e29b-41d4-a716-446655440000'
		const body = JSON.stringify({ locator: 'https://project.supabase.co/object' })
		const bodyHash = createHash('sha256').update(body).digest('hex')
		const signature = createHmac('sha256', secret)
			.update(`${timestamp}.${nonce}.${bodyHash}`)
			.digest('hex')

		assert.equal(
			verifyBugReportStorageEnvelope({
				secret,
				timestamp,
				nonce,
				bodyHash,
				signature,
				body
			}),
			true
		)
		assert.equal(
			verifyBugReportStorageEnvelope({
				secret,
				timestamp,
				nonce,
				bodyHash,
				signature,
				body: `${body} `
			}),
			false
		)
	})

	it('allows only the configured public avatar bug-report prefix', () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
		assert.equal(
			parseLegacyBugReportLocator(
				'https://project.supabase.co/storage/v1/object/public/letletme/bug-reports/old.png'
			),
			'bug-reports/old.png'
		)
		assert.throws(() =>
			parseLegacyBugReportLocator(
				'https://attacker.example/storage/v1/object/public/letletme/bug-reports/old.png'
			)
		)
		assert.throws(() =>
			parseLegacyBugReportLocator(
				'https://project.supabase.co/storage/v1/object/public/letletme/bug-reports/../old.png'
			)
		)
	})

	it('returns a private object URL, never a public URL', () => {
		assert.equal(
			buildPrivateBugReportLocator(
				'bug-reports/550e8400-e29b-41d4-a716-446655440000.jpg',
				'https://project.supabase.co'
			),
			'https://project.supabase.co/storage/v1/object/bug-report-screenshots/bug-reports/550e8400-e29b-41d4-a716-446655440000.jpg'
		)
	})
})
