import assert from 'node:assert/strict'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { describe, it } from 'node:test'

import { verifyBugReportStorageSignature } from '../lib/bug-report-signature'
import { parseBugReportStorageLocator } from '../lib/bug-report-storage-locator'

describe('bug report storage signatures', () => {
	it('binds timestamp, nonce, body hash and rejects replay or tampering', () => {
		const previous = process.env.BUG_REPORT_CLEANUP_SECRET
		process.env.BUG_REPORT_CLEANUP_SECRET = 'test-secret'
		try {
			const body = JSON.stringify({
				locator:
					'https://example.test/storage/v1/object/bug-reports/bug-reports/a.png'
			})
			const timestamp = String(Date.now())
			const nonce = randomUUID()
			const bodyHash = createHash('sha256').update(body).digest('hex')
			const signature = createHmac('sha256', 'test-secret')
				.update(
					`POST./api/internal/bug-report-storage/delete.${timestamp}.${nonce}.${bodyHash}`
				)
				.digest('hex')
			const request = new Request(
				'https://example.test/api/internal/bug-report-storage/delete',
				{
					method: 'POST',
					headers: {
						'x-bug-report-timestamp': timestamp,
						'x-bug-report-nonce': nonce,
						'x-bug-report-body-sha256': bodyHash,
						'x-bug-report-signature': signature
					}
				}
			)
			assert.equal(verifyBugReportStorageSignature(request, body), true)
			assert.equal(verifyBugReportStorageSignature(request, body), false)
			assert.equal(verifyBugReportStorageSignature(request, `${body} `), false)

			const crossRouteNonce = randomUUID()
			const crossRouteSignature = createHmac('sha256', 'test-secret')
				.update(
					`POST./api/internal/bug-report-storage/delete.${timestamp}.${crossRouteNonce}.${bodyHash}`
				)
				.digest('hex')
			const crossRouteRequest = new Request(
				'https://example.test/api/internal/bug-report-storage/migrate',
				{
					headers: {
						'x-bug-report-timestamp': timestamp,
						'x-bug-report-nonce': crossRouteNonce,
						'x-bug-report-body-sha256': bodyHash,
						'x-bug-report-signature': crossRouteSignature
					}
				}
			)
			assert.equal(verifyBugReportStorageSignature(crossRouteRequest, body), false)
		} finally {
			if (previous === undefined) delete process.env.BUG_REPORT_CLEANUP_SECRET
			else process.env.BUG_REPORT_CLEANUP_SECRET = previous
		}
	})
})

describe('bug report storage locator parsing', () => {
	it('distinguishes private current objects from legacy public objects', () => {
		const previous = process.env.NEXT_PUBLIC_SUPABASE_URL
		process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
		try {
			assert.deepEqual(
				parseBugReportStorageLocator(
					'https://project.supabase.co/storage/v1/object/bug-reports/bug-reports/current.png'
				),
				{
					bucket: 'bug-reports',
					path: 'bug-reports/current.png',
					public: false
				}
			)
			assert.deepEqual(
				parseBugReportStorageLocator(
					'https://project.supabase.co/storage/v1/object/public/letletme/bug-reports/legacy.png'
				),
				{ bucket: 'letletme', path: 'bug-reports/legacy.png', public: true }
			)
		} finally {
			if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
			else process.env.NEXT_PUBLIC_SUPABASE_URL = previous
		}
	})
})
