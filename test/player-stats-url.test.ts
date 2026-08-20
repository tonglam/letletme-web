import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildPlayerStatsQueryString,
	isPlayerStatsSupportingSection,
	parsePlayerStatsPlayerId,
	playerStatsSectionFromHash
} from '../app/data/player-stats/_lib/player-stats-url'

describe('player stats URL contract', () => {
	it('accepts only positive integer player ids', () => {
		assert.equal(parsePlayerStatsPlayerId('42'), 42)
		assert.equal(parsePlayerStatsPlayerId('42.9'), null)
		assert.equal(parsePlayerStatsPlayerId('0'), null)
		assert.equal(parsePlayerStatsPlayerId('invalid'), null)
	})

	it('keeps p2 only behind a distinct p1', () => {
		assert.equal(buildPlayerStatsQueryString({ p2: '22' }), '')
		assert.equal(buildPlayerStatsQueryString({ p1: '11', p2: '11' }), 'p1=11')
		assert.equal(
			buildPlayerStatsQueryString({ p1: '11', p2: '22' }),
			'p1=11&p2=22'
		)
	})

	it('ignores non-canonical hashes', () => {
		assert.equal(playerStatsSectionFromHash('#ps-ict'), null)
		assert.equal(playerStatsSectionFromHash('#ict'), null)
		assert.equal(playerStatsSectionFromHash('#recent'), null)
		assert.equal(playerStatsSectionFromHash('#ps-overview'), null)
		assert.equal(playerStatsSectionFromHash('#ps-recent'), 'recent')
	})

	it('supports evidence and More context deep links', () => {
		assert.equal(playerStatsSectionFromHash('#ps-fixtures'), 'fixtures')
		assert.equal(playerStatsSectionFromHash('#ps-season'), 'season')
		assert.equal(playerStatsSectionFromHash('#ps-process'), 'process')
		assert.equal(playerStatsSectionFromHash('#ps-history'), 'history')
		assert.equal(playerStatsSectionFromHash('#ps-market'), 'market')
		assert.equal(playerStatsSectionFromHash('#ps-coverage'), 'coverage')
	})

	it('keeps supporting-data sections reachable during preseason', () => {
		assert.equal(isPlayerStatsSupportingSection('history'), true)
		assert.equal(isPlayerStatsSupportingSection('market'), true)
		assert.equal(isPlayerStatsSupportingSection('coverage'), true)
		assert.equal(isPlayerStatsSupportingSection('process'), false)
	})
})
