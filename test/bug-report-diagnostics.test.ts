import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import {
	collectBrowserBugReportMeta,
	resetBugReportDiagnosticsForTests,
	recordBugReportDiagnostic
} from '../lib/bug-report-diagnostics'

const originalWindow = globalThis.window
const originalDocument = globalThis.document
const originalNavigator = globalThis.navigator

afterEach(() => {
	resetBugReportDiagnosticsForTests()
	Object.defineProperty(globalThis, 'window', {
		configurable: true,
		value: originalWindow
	})
	Object.defineProperty(globalThis, 'document', {
		configurable: true,
		value: originalDocument
	})
	Object.defineProperty(globalThis, 'navigator', {
		configurable: true,
		value: originalNavigator
	})
})

describe('browser bug-report diagnostics', () => {
	it('maps browser facts into the bounded cross-client metadata contract', () => {
		recordBugReportDiagnostic({
			at: '2026-08-20T00:00:00.000Z',
			operation: 'LiveFixturePlayers',
			requestId: 'request-1',
			code: 'UPSTREAM_GRAPHQL_ERROR',
			status: 502
		})
		Object.defineProperty(globalThis, 'window', {
			configurable: true,
			value: { location: { pathname: '/live/matches' }, innerWidth: 390, innerHeight: 844 }
		})
		Object.defineProperty(globalThis, 'document', {
			configurable: true,
			value: { documentElement: { lang: 'zh-CN' } }
		})
		Object.defineProperty(globalThis, 'navigator', {
			configurable: true,
			value: {
				language: 'zh-CN',
				platform: 'iPhone',
				userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)'
			}
		})

		const meta = collectBrowserBugReportMeta()
		assert.equal(meta.route, '/live/matches')
		assert.equal(meta.envVersion, 'web')
		assert.equal(meta.platform, 'ios')
		assert.equal(meta.osMajor, 17)
		assert.equal(meta.language, 'zh-CN')
		assert.equal(meta.viewportBucket, 'smallxmedium')
		assert.deepEqual(meta.operations, [
			{
				operation: 'LiveFixturePlayers',
				requestId: 'request-1',
				code: 'UPSTREAM_GRAPHQL_ERROR',
				status: 502
			}
		])
		assert.equal('userAgent' in meta, false)
		assert.equal('timeZone' in meta, false)
		assert.equal('viewport' in meta, false)
	})
})
