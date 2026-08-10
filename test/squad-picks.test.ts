import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { squadMatchKey } from '../lib/fixtures-fdr'
import {
	buildSquadTeamExposure,
	entryPickToSquadSeed,
	formatSquadTeamExposure,
	isSquadStarter,
	positionCodeFromElementTypeName,
	squadPicksFromEntry,
} from '../lib/squad-picks'

describe('entryPickToSquadSeed', () => {
	it('prefers GraphQL element id over picker map', () => {
		const map = new Map([[squadMatchKey('Salah', 'LIV'), 99]])
		const seed = entryPickToSquadSeed(
			{
				webName: 'Salah',
				teamShortName: 'LIV',
				elementTypeName: 'MIDFIELDER',
				position: 8,
				multiplier: 2,
				isCaptain: true,
				isViceCaptain: false,
				element: 381,
			},
			map,
		)
		assert.equal(seed.elementId, 381)
	})

	it('falls back to squad key map when element is missing', () => {
		const map = new Map([[squadMatchKey('Saka', 'ARS'), 16]])
		const seed = entryPickToSquadSeed(
			{
				webName: 'Saka',
				teamShortName: 'ARS',
				elementTypeName: 'MIDFIELDER',
				position: 3,
				multiplier: 1,
				isCaptain: false,
				isViceCaptain: false,
			},
			map,
		)
		assert.equal(seed.elementId, 16)
	})
})

describe('squadPicksFromEntry', () => {
	it('maps all picks preserving order', () => {
		const picks = squadPicksFromEntry([
			{
				webName: 'A',
				teamShortName: 'AAA',
				elementTypeName: 'DEFENDER',
				position: 1,
				multiplier: 1,
				isCaptain: false,
				isViceCaptain: false,
				element: 1,
			},
			{
				webName: 'B',
				teamShortName: 'BBB',
				elementTypeName: 'MIDFIELDER',
				position: 12,
				multiplier: 0,
				isCaptain: false,
				isViceCaptain: false,
			},
		])
		assert.equal(picks.length, 2)
		assert.equal(picks[0]!.elementId, 1)
		assert.equal(picks[1]!.elementId, null)
	})
})

describe('positionCodeFromElementTypeName', () => {
	it('normalizes FPL element type names', () => {
		assert.equal(positionCodeFromElementTypeName('GOALKEEPER'), 'GKP')
		assert.equal(positionCodeFromElementTypeName('midfielder'), 'MID')
		assert.equal(positionCodeFromElementTypeName('Forward'), 'FWD')
	})
})

describe('isSquadStarter', () => {
	it('uses squad position even when Bench Boost makes every multiplier positive', () => {
		assert.equal(
			isSquadStarter({
				elementId: 1,
				webName: 'A',
				teamShortName: 'AAA',
				elementTypeName: 'MID',
				position: 11,
				multiplier: 1,
				isCaptain: false,
				isViceCaptain: false,
			}),
			true,
		)
		assert.equal(
			isSquadStarter({
				elementId: 2,
				webName: 'B',
				teamShortName: 'BBB',
				elementTypeName: 'MID',
				position: 12,
				multiplier: 1,
				isCaptain: false,
				isViceCaptain: false,
			}),
			false,
		)
	})
})

describe('buildSquadTeamExposure', () => {
	it('aggregates count and positions per club', () => {
		const map = buildSquadTeamExposure([
			{
				elementId: 1,
				webName: 'Saliba',
				teamShortName: 'ARS',
				elementTypeName: 'DEFENDER',
				position: 2,
				multiplier: 1,
				isCaptain: false,
				isViceCaptain: false,
			},
			{
				elementId: 2,
				webName: 'Gabriel',
				teamShortName: 'ARS',
				elementTypeName: 'DEFENDER',
				position: 3,
				multiplier: 1,
				isCaptain: false,
				isViceCaptain: false,
			},
			{
				elementId: 3,
				webName: 'Saka',
				teamShortName: 'ARS',
				elementTypeName: 'MIDFIELDER',
				position: 6,
				multiplier: 1,
				isCaptain: false,
				isViceCaptain: false,
			},
			{
				elementId: 4,
				webName: 'Salah',
				teamShortName: 'LIV',
				elementTypeName: 'MIDFIELDER',
				position: 5,
				multiplier: 2,
				isCaptain: true,
				isViceCaptain: false,
			},
		])
		const ars = map.get('ars')
		assert.ok(ars)
		assert.equal(ars!.count, 3)
		assert.equal(ars!.byPos.DEF, 2)
		assert.equal(ars!.byPos.MID, 1)
		assert.equal(formatSquadTeamExposure(ars!), '×3 · 2DEF · MID')
		assert.equal(formatSquadTeamExposure(map.get('liv')!), '×1 · MID')
	})

	it('caps at 3 players per club', () => {
		const map = buildSquadTeamExposure([
			{
				elementId: 1,
				webName: 'A',
				teamShortName: 'ARS',
				elementTypeName: 'GOALKEEPER',
				position: 1,
				multiplier: 1,
				isCaptain: false,
				isViceCaptain: false,
			},
			{
				elementId: 2,
				webName: 'B',
				teamShortName: 'ARS',
				elementTypeName: 'DEFENDER',
				position: 2,
				multiplier: 1,
				isCaptain: false,
				isViceCaptain: false,
			},
			{
				elementId: 3,
				webName: 'C',
				teamShortName: 'ARS',
				elementTypeName: 'MIDFIELDER',
				position: 3,
				multiplier: 1,
				isCaptain: false,
				isViceCaptain: false,
			},
			{
				elementId: 4,
				webName: 'D',
				teamShortName: 'ARS',
				elementTypeName: 'FORWARD',
				position: 4,
				multiplier: 1,
				isCaptain: false,
				isViceCaptain: false,
			},
		])
		assert.equal(map.get('ars')!.count, 3)
		assert.equal(formatSquadTeamExposure(map.get('ars')!), '×3 · GKP · DEF · MID')
	})
})
