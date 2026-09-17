import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const read = (path: string) =>
	readFile(new URL(`../${path}`, import.meta.url), 'utf8')

describe('monitor load reduction contracts', () => {
	it('exposes a pending/leased-only outbox monitor projection with bounded SQL', async () => {
		const source = await read('lib/entry-sync-outbox.ts')
		const route = await read('app/api/cron/entry-sync-outbox/route.ts')
		assert.match(route, /searchParams\.get\('view'\) === 'monitor'/)
		assert.match(route, /getEntrySyncOutboxMonitorHealth/)
		assert.match(route, /processEntrySyncOutbox\(\)[\s\S]*getEntrySyncOutboxMonitorHealth\(\)/)
		assert.doesNotMatch(route, /processEntrySyncOutbox\(\)[\s\S]*getEntrySyncOutboxHealth\(\)/)
		assert.match(source, /view: 'monitor'/)
		assert.match(source, /set_config\('statement_timeout', '2s', true\)/)
		assert.match(source, /set_config\('lock_timeout', '1s', true\)/)
		assert.match(source, /WHERE status IN \('pending', 'leased'\)/)
		assert.doesNotMatch(source.slice(source.indexOf('getEntrySyncOutboxMonitorHealth')), /delivered_count/)
	})

	it('keeps directed MyFPL acceptance bounded separately from the platform ceiling', async () => {
		const route = await read('app/api/ops/data-contracts/[contractKey]/route.ts')
		assert.match(route, /export const maxDuration = 30/)
		assert.match(route, /INTERNAL_DEADLINE_MS = 8_000/)
		assert.match(route, /timeoutMs: Math\.max\(1, deadlineAt - Date\.now\(\)\)/)
	})
})
