import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { resolvePriceChangeLivePollPolicy } from '../lib/price-change-live-client'

const deadlineMs = Date.parse('2026-08-27T07:00:00.000Z')
const board = {
	deadline: new Date(deadlineMs).toISOString(),
	nextDeadlines: []
}

describe('price-change live polling policy', () => {
	it('starts five minutes before the official deadline', () => {
		assert.equal(
			resolvePriceChangeLivePollPolicy(board, deadlineMs - 5 * 60_000).delayMs,
			2_000
		)
		assert.equal(
			resolvePriceChangeLivePollPolicy(board, deadlineMs - 5 * 60_000 - 1)
				.delayMs,
			60_000
		)
	})

	it('polls twice per second for the final ten seconds and post-deadline window', () => {
		assert.equal(
			resolvePriceChangeLivePollPolicy(board, deadlineMs - 10_001).delayMs,
			2_000
		)
		assert.equal(
			resolvePriceChangeLivePollPolicy(board, deadlineMs - 10_000).delayMs,
			500
		)
		assert.equal(
			resolvePriceChangeLivePollPolicy(board, deadlineMs).delayMs,
			500
		)
		assert.equal(
			resolvePriceChangeLivePollPolicy(board, deadlineMs + 5 * 60_000).delayMs,
			500
		)
		assert.equal(
			resolvePriceChangeLivePollPolicy(board, deadlineMs + 5 * 60_000 + 1)
				.delayMs,
			60_000
		)
	})

	it('retains the active window after a provisional board rolls to the next deadline', () => {
		const active = resolvePriceChangeLivePollPolicy(board, deadlineMs - 1_000)
		const rolledBoard = {
			deadline: new Date(deadlineMs + 24 * 60 * 60_000).toISOString(),
			nextDeadlines: []
		}
		const retained = resolvePriceChangeLivePollPolicy(
			rolledBoard,
			deadlineMs + 1_000,
			active.windowDeadline
		)

		assert.equal(retained.windowDeadline, deadlineMs)
		assert.equal(retained.delayMs, 500)
	})
})
