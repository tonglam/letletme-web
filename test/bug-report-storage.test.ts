import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { canCleanupBugReportScreenshotAfterDataAttempts } from '../lib/bug-report-retry'

describe('private bug-report screenshot storage contract', () => {
	it('builds a deterministic key under the private bucket for every supported type', () => {
		const submissionId = '550e8400-e29b-41d4-a716-446655440000'
		const source = readFileSync('lib/supabase-storage.ts', 'utf8')
		assert.match(source, /BUG_REPORT_SCREENSHOT_BUCKET = 'bug-report-screenshots'/)
		assert.match(source, /return `bug-reports\/\$\{submissionId\}\.\$\{extensionForContentType\(contentType\)\}`/)
		assert.match(source, /'image\/jpeg'/)
		assert.match(source, /'image\/png'/)
		assert.match(source, /'image\/webp'/)
		assert.match(source, /'image\/gif'/)
	})

	it('never cleans up after an ambiguous Data attempt followed by a rejection', () => {
		assert.equal(
			canCleanupBugReportScreenshotAfterDataAttempts(['ambiguous', 'definitive-rejection']),
			false
		)
		assert.equal(
			canCleanupBugReportScreenshotAfterDataAttempts(['definitive-rejection']),
			true
		)
		assert.equal(
			canCleanupBugReportScreenshotAfterDataAttempts(['definitive-rejection', 'ambiguous']),
			false
		)
	})
})
