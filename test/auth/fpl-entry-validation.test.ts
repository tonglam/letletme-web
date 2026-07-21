/**
 * Tests for FPL entry ID validation used in the bind-entry server action.
 *
 * The server action (app/onboarding/bind-entry/actions.ts) validates the
 * entered FPL entry ID before writing it to the user record. We test the
 * validation rules that don't require a real network call.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
	assertFplEntryId,
	fplTeamNamesMatch,
} from '../../lib/fpl-binding-core'

// ─── validation logic (mirrors actions.ts) ────────────────────────────────────

function validateEntryIdFormat(raw: FormDataEntryValue | null): {
	valid: boolean
	entryId?: number
	error?: string
} {
	const entryId = Number(raw)
	if (!Number.isInteger(entryId) || entryId <= 0) {
		return { valid: false, error: 'Enter a valid FPL entry ID (positive integer)' }
	}
	return { valid: true, entryId }
}

// Simulate the shape the FPL API returns
interface FplApiResponse {
	id: number
	player_first_name: string
	player_last_name: string
	name: string
}

function parseManagerName(data: FplApiResponse): string {
	return `${data.player_first_name} ${data.player_last_name}`
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('FPL entry ID format validation', () => {
	it('accepts a positive integer entry ID', () => {
		const result = validateEntryIdFormat('15702')
		assert.equal(result.valid, true)
		assert.equal(result.entryId, 15702)
	})

	it('rejects zero', () => {
		const result = validateEntryIdFormat('0')
		assert.equal(result.valid, false)
		assert.ok(result.error)
	})

	it('rejects a negative number', () => {
		const result = validateEntryIdFormat('-1')
		assert.equal(result.valid, false)
	})

	it('rejects a float', () => {
		const result = validateEntryIdFormat('123.45')
		assert.equal(result.valid, false)
	})

	it('rejects an empty string', () => {
		const result = validateEntryIdFormat('')
		assert.equal(result.valid, false)
	})

	it('rejects arbitrary text', () => {
		const result = validateEntryIdFormat('abc')
		assert.equal(result.valid, false)
	})

	it('rejects null (missing form field)', () => {
		const result = validateEntryIdFormat(null)
		assert.equal(result.valid, false)
	})

	it('accepts a very large integer (bounds check deferred to FPL API)', () => {
		// The format validator only checks isInteger && > 0.
		// Out-of-range IDs are rejected by the FPL API returning a 404.
		const result = validateEntryIdFormat('99999999')
		assert.equal(result.valid, true)
	})
})

describe('FPL API response parsing', () => {
	it('builds manager name from first and last name', () => {
		const data: FplApiResponse = {
			id: 15702,
			player_first_name: 'Jane',
			player_last_name: 'Smith',
			name: 'Jane FC',
		}
		assert.equal(parseManagerName(data), 'Jane Smith')
	})

	it('handles single-word names', () => {
		const data: FplApiResponse = {
			id: 1,
			player_first_name: 'Cher',
			player_last_name: '',
			name: 'Team Cher',
		}
		assert.equal(parseManagerName(data), 'Cher ')
	})
})

describe('FPL ownership challenge matching', () => {
	it('requires an exact trimmed, case-insensitive team name', () => {
		assert.equal(fplTeamNamesMatch('  llm-a1b2c3 ', 'LLM-A1B2C3'), true)
		assert.equal(fplTeamNamesMatch('LLM-A1B2C3 FC', 'LLM-A1B2C3'), false)
	})

	it('uses the shared positive-integer validator', () => {
		assert.equal(assertFplEntryId('15702'), 15702)
		assert.throws(() => assertFplEntryId('1.5'))
	})
})
