import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildSelectionsShareUrl,
	formatCaptainShareText,
	formatOwnershipShareText,
	formatTransferShareText,
} from '../app/data/selections/_lib/selections-share'
import type { TournamentStatPlayer } from '../lib/graphql/operations/tournaments'

const salah: TournamentStatPlayer = {
	id: 351,
	webName: 'Salah',
	teamShortName: 'LIV',
	position: 'MIDFIELDER',
	selectedByPercent: 92.4,
	eoByPercent: 118.2,
	captainByPercent: 54.2,
}

const palmer: TournamentStatPlayer = {
	id: 131,
	webName: 'Palmer',
	teamShortName: 'CHE',
	position: 'MIDFIELDER',
	selectedByPercent: 48.2,
	transfersEvent: 4,
}

const scope = {
	tournamentName: 'Office Classic',
	gameweek: 28,
	totalEntries: 12,
}

describe('formatOwnershipShareText', () => {
	it('formats ownership lines with position and EO', () => {
		const text = formatOwnershipShareText([salah], scope, {
			title: 'Squad ownership',
			none: 'None',
			fieldLine: 'Field: 12 managers',
			footer: 'https://letletme.top/explore/selections',
		})
		assert.match(text, /^Squad ownership · Office Classic · GW28/)
		assert.match(text, /Field: 12 managers/)
		assert.match(text, /^- Salah MID LIV · 92\.4% · EO 118\.2%$/m)
		assert.match(text, /https:\/\/letletme\.top\/explore\/selections$/)
	})
})

describe('formatCaptainShareText', () => {
	it('formats captain percent', () => {
		const text = formatCaptainShareText([salah], scope, {
			title: 'Captaincy',
			none: 'None',
		})
		assert.match(text, /^- Salah MID LIV · 54\.2% · EO 118\.2%$/m)
	})
})

describe('formatTransferShareText', () => {
	it('formats in and out columns', () => {
		const text = formatTransferShareText([palmer], [], scope, {
			title: 'Transfer desk',
			none: 'None',
			transfersIn: 'In',
			transfersOut: 'Out',
		})
		assert.match(text, /In \(1\)/)
		assert.match(text, /^- Palmer MID CHE · 4 · 48\.2%$/m)
		assert.match(text, /Out \(0\)\nNone/)
	})
})

describe('buildSelectionsShareUrl', () => {
	it('builds locale-aware path', () => {
		assert.equal(
			buildSelectionsShareUrl('https://letletme.top', ''),
			'https://letletme.top/explore/selections',
		)
		assert.equal(
			buildSelectionsShareUrl('https://letletme.top/', '/zh-CN'),
			'https://letletme.top/zh-CN/explore/selections',
		)
	})

	it('serializes a reproducible public league scope', () => {
		assert.equal(
			buildSelectionsShareUrl('https://letletme.top', '', {
				scope: 'public',
				tournamentId: 42,
				gameweek: 6,
			}),
			'https://letletme.top/explore/selections?scope=public&tournament=42&gw=6',
		)
	})
})
