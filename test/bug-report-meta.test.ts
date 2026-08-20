import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	decodeOptionalScreenshot,
	normalizeBugReportBody,
	sanitizeBugReportClientMeta
} from '../lib/bug-report-meta'
import {
	recordBugReportDiagnostic,
	readBugReportDiagnostics,
	resetBugReportDiagnosticsForTests
} from '../lib/bug-report-diagnostics'

describe('bug report client meta', () => {
	it('drops credential-like keys and oversized payloads', () => {
		assert.deepEqual(
			sanitizeBugReportClientMeta({
				route: '/home',
				token: 'secret-session',
				Authorization: 'Bearer abc',
				cookie: 'sid=1'
			}),
			{ route: '/home' }
		)
		assert.deepEqual(sanitizeBugReportClientMeta({ note: 'x'.repeat(20_000) }), {})
	})

	it('normalizes the description and rejects oversized screenshots', () => {
		assert.equal(normalizeBugReportBody('  hello there  '), 'hello there')
		assert.equal(decodeOptionalScreenshot('', 'image/jpeg'), null)
		assert.throws(
			() =>
				decodeOptionalScreenshot(
					Buffer.alloc(2 * 1024 * 1024 + 8).toString('base64'),
					'image/jpeg'
				),
			/SCREENSHOT_TOO_LARGE/
		)
		assert.throws(
			() =>
				decodeOptionalScreenshot(
					Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>').toString('base64'),
					'image/svg+xml'
				),
			/SCREENSHOT_UNSUPPORTED/
		)
		assert.equal(
			decodeOptionalScreenshot(Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64'), 'image/png')
				?.contentType,
			'image/jpeg'
		)
		assert.equal(
			decodeOptionalScreenshot(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64'), 'image/jpeg')
				?.contentType,
			'image/png'
		)
		assert.equal(
			decodeOptionalScreenshot(Buffer.from('GIF89a').toString('base64'), 'image/png')?.contentType,
			'image/gif'
		)
		assert.equal(
			decodeOptionalScreenshot(Buffer.from('RIFFxxxxWEBP').toString('base64'), 'image/jpeg')?.contentType,
			'image/webp'
		)
		assert.throws(
			() => decodeOptionalScreenshot(Buffer.from('not-an-image').toString('base64'), 'image/png'),
			/SCREENSHOT_UNSUPPORTED/
		)
	})

	it('keeps the last three GraphQL diagnostics', () => {
		resetBugReportDiagnosticsForTests()
		recordBugReportDiagnostic({ at: '1', requestId: 'a' })
		recordBugReportDiagnostic({ at: '2', requestId: 'b' })
		recordBugReportDiagnostic({ at: '3', requestId: 'c' })
		recordBugReportDiagnostic({ at: '4', requestId: 'd' })
		assert.deepEqual(
			readBugReportDiagnostics().map(item => item.requestId),
			['b', 'c', 'd']
		)
	})
})
