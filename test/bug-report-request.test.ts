import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	InvalidBugReportJsonError,
	readBugReportJson
} from '../lib/bug-report-request'
import { PayloadTooLargeError } from '../lib/http-security-core'

describe('bug report request body contract', () => {
	it('maps empty and malformed JSON to a stable parse error', async () => {
		for (const body of ['', '{']) {
			await assert.rejects(
				() =>
					readBugReportJson(
						new Request('http://localhost', { method: 'POST', body }),
						1024
					),
				InvalidBugReportJsonError
			)
		}
	})

	it('keeps the body-size error distinct from malformed JSON', async () => {
		await assert.rejects(
			() =>
				readBugReportJson(
					new Request('http://localhost', {
						method: 'POST',
						body: 'x'.repeat(1025)
					}),
					1024
				),
			PayloadTooLargeError
		)
		assert.deepEqual(
			await readBugReportJson(
				new Request('http://localhost', { method: 'POST', body: '[1]' }),
				1024
			),
			[1]
		)
	})
})
