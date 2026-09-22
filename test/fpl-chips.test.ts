import assert from 'node:assert/strict'
import test from 'node:test'
import {
	FPL_CHIPS,
	FPL_CHIP_VALUES,
	LIVE_COMPETITION_CHIP_OPTIONS,
	isFplChip
} from '../lib/fpl/chips'

test('keeps one typed FPL chip contract and excludes NONE from selectable options', () => {
	assert.deepEqual(FPL_CHIP_VALUES, [
		FPL_CHIPS.NONE,
		FPL_CHIPS.BENCH_BOOST,
		FPL_CHIPS.TRIPLE_CAPTAIN,
		FPL_CHIPS.FREE_HIT,
		FPL_CHIPS.WILDCARD,
		FPL_CHIPS.MANAGER
	])
	assert.equal(new Set(FPL_CHIP_VALUES).size, FPL_CHIP_VALUES.length)
	assert.deepEqual(LIVE_COMPETITION_CHIP_OPTIONS, [
		FPL_CHIPS.TRIPLE_CAPTAIN,
		FPL_CHIPS.BENCH_BOOST,
		FPL_CHIPS.WILDCARD,
		FPL_CHIPS.FREE_HIT,
		FPL_CHIPS.MANAGER
	])
	assert.ok(LIVE_COMPETITION_CHIP_OPTIONS.every(isFplChip))
	assert.equal(
		LIVE_COMPETITION_CHIP_OPTIONS.some(
			chip => (chip as string) === FPL_CHIPS.NONE
		),
		false
	)
})
