import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import {
	isOfficialLiveUpdatingContext,
	isOfficialLiveUpdatingSignal,
} from '@/lib/live-updating'

describe('official live updating state', () => {
	it('recognises the expected post-deadline picks lifecycle', () => {
		for (const signal of ['PICKS_WAIT', 'PICKS_PROBE', 'PICKS_SYNC'] as const) {
			assert.equal(isOfficialLiveUpdatingSignal(signal), true)
			assert.equal(
				isOfficialLiveUpdatingContext({
					producerState: signal,
					dataAvailability: 'UNAVAILABLE',
				}),
				true,
			)
		}
	})

	it('does not classify unrelated, live, or settled states as updating', () => {
		assert.equal(isOfficialLiveUpdatingSignal('PRE_DEADLINE'), false)
		assert.equal(isOfficialLiveUpdatingSignal('LIVE_ACTIVE'), false)
		assert.equal(
			isOfficialLiveUpdatingContext({
				producerState: 'PICKS_SYNC',
				dataAvailability: 'FRESH',
			}),
			false,
		)
		assert.equal(
			isOfficialLiveUpdatingContext({
				producerState: 'LIVE_ACTIVE',
				dataAvailability: 'UNAVAILABLE',
			}),
			false,
		)
		assert.equal(isOfficialLiveUpdatingContext(null), false)
	})

	it('uses status semantics instead of alert semantics for the normal window', async () => {
		const [phaseState, priceBoard] = await Promise.all([
			readFile(new URL('../components/feedback/SeasonPhaseState.tsx', import.meta.url), 'utf8'),
			readFile(new URL('../app/data/price-changes/PriceChangesBoard.tsx', import.meta.url), 'utf8'),
		])

		assert.match(phaseState, /isOfficialLiveUpdatingSignal\(presentation\.signal\)/)
		assert.match(phaseState, /role="status"/)
		assert.match(priceBoard, /if \(officialUpdating\) return null/)
		assert.match(priceBoard, /role="status"/)

		const pricePage = await readFile(
			new URL('../app/[locale]/explore/price-predictions/page.tsx', import.meta.url),
			'utf8',
		)
		assert.match(pricePage, /isOfficialUpdating\s*\n?\s*\? 'STALE'/)
	})
})
