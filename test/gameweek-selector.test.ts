import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	buildGameweekValuesDesc,
	canStepGameweek,
	parseGameweekJump,
	resolveSelectedGameweek,
} from '../lib/gameweek-selector'

describe('resolveSelectedGameweek', () => {
	it('defaults to current when no selection', () => {
		assert.deepEqual(resolveSelectedGameweek(12), {
			maxGameweek: 12,
			selected: 12,
		})
	})

	it('keeps a valid past selection', () => {
		assert.deepEqual(resolveSelectedGameweek(38, 5), {
			maxGameweek: 38,
			selected: 5,
		})
	})

	it('clamps selection above current down to current max', () => {
		assert.deepEqual(resolveSelectedGameweek(10, 20), {
			maxGameweek: 10,
			selected: 10,
		})
	})

	it('clamps non-positive selection up to 1', () => {
		assert.deepEqual(resolveSelectedGameweek(12, 0), {
			maxGameweek: 12,
			selected: 1,
		})
		assert.deepEqual(resolveSelectedGameweek(12, -3), {
			maxGameweek: 12,
			selected: 1,
		})
	})
})

describe('buildGameweekValuesDesc', () => {
	it('lists 38 gameweeks newest-first so current is first', () => {
		const values = buildGameweekValuesDesc(38)
		assert.equal(values.length, 38)
		assert.equal(values[0], 38)
		assert.equal(values[values.length - 1], 1)
		assert.deepEqual(values.slice(0, 3), [38, 37, 36])
	})

	it('handles early-season max=1', () => {
		assert.deepEqual(buildGameweekValuesDesc(1), [1])
	})
})

describe('parseGameweekJump', () => {
	it('jumps directly to a middle gameweek', () => {
		assert.equal(parseGameweekJump('12', 38), 12)
	})

	it('clamps above max and below 1', () => {
		assert.equal(parseGameweekJump('99', 38), 38)
		assert.equal(parseGameweekJump('0', 38), 1)
		assert.equal(parseGameweekJump('-3', 38), 1)
	})

	it('rejects non-integers so the UI can reset the draft', () => {
		assert.equal(parseGameweekJump('', 38), null)
		assert.equal(parseGameweekJump('abc', 38), null)
		assert.equal(parseGameweekJump('12.7', 38), 12)
	})
})

describe('canStepGameweek', () => {
	it('disables prev on GW1 and next on max', () => {
		assert.deepEqual(canStepGameweek(1, 38, false), {
			prev: false,
			next: true,
		})
		assert.deepEqual(canStepGameweek(38, 38, false), {
			prev: true,
			next: false,
		})
		assert.deepEqual(canStepGameweek(20, 38, false), {
			prev: true,
			next: true,
		})
	})

	it('disables both when the control is disabled', () => {
		assert.deepEqual(canStepGameweek(20, 38, true), {
			prev: false,
			next: false,
		})
	})
})
