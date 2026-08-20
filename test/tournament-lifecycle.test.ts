import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	areTournamentStandingsReady,
	getTournamentLifecycleBadge,
	isTournamentRosterSyncInFlight,
	isTournamentSetupInFlight,
	normalizeTournamentSetupStatus,
	shouldPollTournamentSetup
} from '@/lib/tournament/lifecycle'
import {
	mapEntryTournamentToLiveTournament,
	mapTournamentGroupFormat
} from '@/lib/tournament/liveTournament'
import { resolveTournamentStatsLoadState } from '@/app/me/tournament/_lib/tournament-stats-model'
import type { EntryTournament } from '@/lib/graphql/operations/tournaments'

const lifecycle = (
	overrides: Partial<Parameters<typeof getTournamentLifecycleBadge>[0]> = {}
): Parameters<typeof getTournamentLifecycleBadge>[0] => ({
	state: 'ACTIVE',
	rosterSyncStatus: 'READY',
	setupStatus: 'READY',
	standingsReadyAt: '2026-08-04T00:00:00.000Z',
	setupHasWarnings: false,
	...overrides
})

describe('tournament lifecycle presentation', () => {
	it('prioritizes terminal and attention states', () => {
		assert.equal(
			getTournamentLifecycleBadge(lifecycle({ state: 'FINISHED' })),
			'finished'
		)
		assert.equal(
			getTournamentLifecycleBadge(lifecycle({ rosterSyncStatus: 'FAILED' })),
			'needsAttention'
		)
		assert.equal(
			getTournamentLifecycleBadge(
				lifecycle({ setupStatus: 'FAILED', standingsReadyAt: null })
			),
			'needsAttention'
		)
		assert.equal(
			getTournamentLifecycleBadge(lifecycle({ setupStatus: 'FAILED' })),
			'needsAttention'
		)
	})

	it('separates shell, standings, enrichment, warnings, and pause states', () => {
		assert.equal(
			getTournamentLifecycleBadge(lifecycle({ standingsReadyAt: null })),
			'settingUp'
		)
		assert.equal(
			getTournamentLifecycleBadge(lifecycle({ setupStatus: 'PROCESSING' })),
			'standingsReady'
		)
		assert.equal(
			getTournamentLifecycleBadge(lifecycle({ setupHasWarnings: true })),
			'readyWithWarnings'
		)
		assert.equal(
			getTournamentLifecycleBadge(lifecycle({ state: 'INACTIVE' })),
			'paused'
		)
	})

	it('polls only for non-terminal setup while visible and online', () => {
		assert.equal(
			shouldPollTournamentSetup({
				setupStatus: 'PROCESSING',
				visible: true,
				online: true
			}),
			true
		)
		assert.equal(
			shouldPollTournamentSetup({
				setupStatus: 'READY',
				visible: true,
				online: true
			}),
			false
		)
		assert.equal(
			shouldPollTournamentSetup({
				setupStatus: 'PROCESSING',
				visible: false,
				online: true
			}),
			false
		)
		assert.equal(
			shouldPollTournamentSetup({
				setupStatus: 'PROCESSING',
				visible: true,
				online: false
			}),
			false
		)
	})

	it('treats queued and processing roster synchronization as in flight', () => {
		assert.equal(isTournamentRosterSyncInFlight('PENDING'), true)
		assert.equal(isTournamentRosterSyncInFlight('PROCESSING'), true)
		assert.equal(isTournamentRosterSyncInFlight('READY'), false)
		assert.equal(isTournamentRosterSyncInFlight('FAILED'), false)
		assert.equal(isTournamentRosterSyncInFlight(null), false)
	})

	it('treats queued and processing setup as in flight', () => {
		assert.equal(isTournamentSetupInFlight('PENDING'), true)
		assert.equal(isTournamentSetupInFlight('PROCESSING'), true)
		assert.equal(isTournamentSetupInFlight('READY'), false)
		assert.equal(isTournamentSetupInFlight('FAILED'), false)
	})

	it('preserves readiness in the shared tournament view', () => {
		const mapped = mapEntryTournamentToLiveTournament({
			id: 12,
			name: 'Setup shell',
			totalTeamNum: 75,
			setupStatus: 'PROCESSING',
			standingsReadyAt: null,
			setupHasWarnings: false
		} as EntryTournament)

		assert.equal(mapped.setupStatus, 'PROCESSING')
		assert.equal(mapped.standingsReadyAt, null)
		assert.equal(mapped.setupHasWarnings, false)
		assert.equal(areTournamentStandingsReady(mapped), false)
	})

	it('maps the canonical battle-race group mode', () => {
		assert.equal(mapTournamentGroupFormat('POINTS_RACES'), 'points')
		assert.equal(mapTournamentGroupFormat('BATTLE_RACES'), 'headToHead')
		assert.equal(mapTournamentGroupFormat('NONE'), 'none')
	})

	it('resets a cancelled stats load when the new tournament is not ready', () => {
		assert.equal(
			resolveTournamentStatsLoadState({
				isBootstrapping: false,
				hasSelectedTournament: true,
				insightsReady: false
			}),
			'reset'
		)
		assert.equal(
			resolveTournamentStatsLoadState({
				isBootstrapping: false,
				hasSelectedTournament: true,
				insightsReady: true
			}),
			'load'
		)
	})

	it('normalizes the safe lowercase service response without accepting invalid counters', () => {
		assert.deepEqual(
			normalizeTournamentSetupStatus({
				tournamentId: 12,
				setupStatus: 'processing',
				setupPhase: 'syncing_entries',
				setupCompletedUnits: 42,
				setupTotalUnits: 75,
				setupProgressUpdatedAt: null,
				setupProgressMode: 'DETERMINATE',
				setupAttempt: 0,
				setupMaxAttempts: 3,
				nextRetryAt: null,
				standingsReadyAt: null,
				profilesReadyAt: null,
				insightsReadyAt: null,
				setupHasWarnings: false,
				warningSummaries: [],
				setupStartedAt: null,
				setupFinishedAt: null
			}),
			{
				tournamentId: 12,
				setupStatus: 'PROCESSING',
				setupPhase: 'SYNCING_ENTRIES',
				setupCompletedUnits: 42,
				setupTotalUnits: 75,
				setupProgressMode: 'DETERMINATE',
				setupAttempt: 0,
				setupMaxAttempts: 3,
				nextRetryAt: null,
				setupProgressUpdatedAt: null,
				standingsReadyAt: null,
				profilesReadyAt: null,
				insightsReadyAt: null,
				setupHasWarnings: false,
				warningSummaries: [],
				setupStartedAt: null,
				setupFinishedAt: null
			}
		)
		assert.equal(
			normalizeTournamentSetupStatus({
				tournamentId: 12,
				setupStatus: 'ready',
				setupPhase: 'ready',
				setupCompletedUnits: -1,
				setupTotalUnits: 75
			}),
			null
		)
		assert.equal(
			normalizeTournamentSetupStatus({
				tournamentId: 12,
				setupStatus: 'processing',
				setupPhase: 'syncing_entries',
				setupCompletedUnits: 76,
				setupTotalUnits: 75
			}),
			null
		)
	})
})
