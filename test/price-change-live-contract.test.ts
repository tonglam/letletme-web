import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const read = (path: string) =>
	readFile(new URL(`../${path}`, import.meta.url), 'utf8')

describe('price-change live delivery contract', () => {
	it('keeps cursor polling cacheable for one second and board payloads uncached', async () => {
		const [cursor, board, client, component] = await Promise.all([
			read('app/api/price-changes/live-cursor/route.ts'),
			read('app/api/price-changes/live-board/route.ts'),
			read('lib/price-change-live-client.ts'),
			read('app/data/price-changes/PriceChangesBoard.tsx')
		])
		assert.match(cursor, /s-maxage=1/)
		assert.match(cursor, /stale-while-revalidate=1/)
		assert.match(board, /'Cache-Control': 'no-store'/)
		assert.match(board, /params\.get\('revision'\)/)
		assert.match(board, /params\.get\('sourceHash'\)/)
		assert.match(client, /HOT_WINDOW_BEFORE_MS = 5 \* 60_000/)
		assert.match(client, /HOT_POLL_MS = 2_000/)
		assert.match(client, /FINAL_POLL_MS = 500/)
		assert.match(client, /IDLE_POLL_MS = 60_000/)
		assert.match(client, /\[board\.deadline, \.\.\.board\.nextDeadlines\]/)
		assert.match(client, /visibilitychange/)
		assert.match(component, /liveState === 'PROVISIONAL'/)
		assert.match(component, /persistLastValidBoard\(nextBoard\)/)
		assert.match(component, /router\.refresh\(\)/)
	})

	it('does not persist provisional data into the durable offline cache', async () => {
		const component = await read('app/data/price-changes/PriceChangesBoard.tsx')
		assert.match(
			component,
			/if \(state === 'DURABLE'\) persistLastValidBoard\(nextBoard\)/
		)
		assert.doesNotMatch(component, /localStorage\.setItem\([^\n]*PROVISIONAL/)
	})

	it('updates the homepage projection without serializing the full board', async () => {
		const [client, desk, carousel] = await Promise.all([
			read('lib/price-change-live-client.ts'),
			read('components/home/HomePriceChangeDesk.tsx'),
			read('components/home/HomePriceChangeCarousel.tsx')
		])

		assert.match(client, /export type PriceChangeLiveSeed = Pick</)
		assert.match(client, /'revision' \| 'deadline' \| 'nextDeadlines'/)
		assert.match(client, /export function usePriceChangeLiveUpdates/)
		assert.match(desk, /revision: board\.revision/)
		assert.match(desk, /deadline: board\.deadline/)
		assert.match(desk, /nextDeadlines: board\.nextDeadlines/)
		assert.doesNotMatch(desk, /players: board\.players/)
		assert.doesNotMatch(desk, /durableBoard=/)
		assert.match(carousel, /observedEvent/)
		assert.doesNotMatch(carousel, /durableBoard/)
		assert.match(carousel, /isPriceChangeObservedEventAtLeastAsNew/)
		assert.match(carousel, /usePriceChangeLiveUpdates\(\{/)
		assert.match(
			carousel,
			/buildHomePriceChangePredictionState\(board, locale\)/
		)
		assert.match(carousel, /data-price-change-live-state=\{liveState\}/)
		assert.match(carousel, /data-price-change-revision=\{liveRevision\}/)
	})

	it('keeps the full board on the server side of the market boundary', async () => {
		const [dashboard, explorer, lookup] = await Promise.all([
			read('app/data/market/MarketDashboard.tsx'),
			read('app/data/market/MarketPriceExplorer.tsx'),
			read('components/data/MarketPlayerLookup.tsx')
		])

		assert.match(dashboard, /liveSeed=\{priceLiveSeed\}/)
		assert.match(dashboard, /observedEvent=\{priceEventMetadata\}/)
		assert.doesNotMatch(dashboard, /priceBoard=\{priceChangeBoard\}/)
		assert.doesNotMatch(explorer, /durableBoard:/)
		assert.doesNotMatch(explorer, /priceBoard\?: PriceChangeBoard/)
		assert.match(lookup, /setSelectedPlayer\(seedPlayer \?\? null\)/)
	})
})
