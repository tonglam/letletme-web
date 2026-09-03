import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { GET_LIVE_POINTS } from '../lib/graphql/operations/live'
import { GET_GAMEWEEK_DESK } from '../lib/graphql/operations/gameweek'
import { GET_HOME_GAMEWEEK } from '../lib/graphql/operations/home'
import { GET_TOURNAMENT_DETAIL_DESK } from '../lib/graphql/operations/tournaments'
import {
	LIVE_AUTO_REFRESH_SECONDS,
	resolveLiveRefreshProfile,
	canReplaceLivePointsSnapshot,
	liveContextToSnapshot,
	livePointsRequestChangesEvent,
	liveSnapshotNeedsRefresh,
	shouldSuppressOfficialLiveErrors,
	shouldPollLiveSnapshot
} from '../lib/live-refresh'
import {
	LIVE_MATCHES_CONTRACT_VERSION,
	LIVE_POINTS_CONTRACT_VERSION,
	LIVE_POINTS_V2_ROOT_FIELDS,
	liveContractVersionForQuery,
	requiresLiveMatchesV3Contract,
	requiresLivePointsV2Contract
} from '../lib/graphql-client'
import {
	liveScoreAuthorityLabel,
	traceableLiveScore
} from '../lib/live-score-v2'

const revision = (value: string) => value.repeat(64 / value.length)

it('resolves the production refresh profiles and safe defaults', () => {
	assert.equal(resolveLiveRefreshProfile('normal', 'production'), 'normal')
	assert.equal(resolveLiveRefreshProfile('CONSERVE', 'production'), 'conserve')
	assert.equal(resolveLiveRefreshProfile('manual', 'production'), 'manual')
	assert.equal(resolveLiveRefreshProfile('unexpected', 'production'), 'conserve')
	assert.equal(resolveLiveRefreshProfile(undefined, 'test'), 'normal')
})

const score = (overrides: Record<string, unknown> = {}) => ({
	eventPoints: 71,
	netEventPoints: 67,
	totalPoints: 1267,
	totalScope: 'OVERALL' as const,
	transferCost: 4,
	source: 'FPL_EVENT_LIVE' as const,
	calculationMode: 'PROJECTED_AUTOSUBS' as const,
	revisions: {
		publicationId: 'publication-1',
		generation: 1,
		lifecycle: revision('a'),
		fixtureIdentity: revision('b'),
		scoreCore: revision('c'),
		displayStats: revision('d'),
		explain: revision('e'),
		picksBase: revision('f'),
		officialAdjustment: null,
		previousTotals: revision('g'),
		finalResult: null,
		rules: revision('h'),
		algorithm: 'live-points-v2-algorithm-1',
		input: revision('i')
	},
	times: {
		sourceCheckedAt: '2026-08-29T10:00:00.000Z',
		contentUpdatedAt: '2026-08-29T10:00:00.000Z',
		publishedAt: '2026-08-29T10:00:00.000Z',
		checkpointedAt: null,
		servedAt: '2026-08-29T10:00:01.000Z',
		staleAt: '2026-08-29T10:00:30.000Z',
		nextRefreshAt: null
	},
	delivery: {
		state: 'FRESH' as const,
		servedFrom: 'REDIS_CURRENT' as const,
		reasonCodes: []
	},
	...overrides
})

describe('Live Points V2 web contract', () => {
	it('covers every GraphQL-gated root, including all three desk surfaces', () => {
		assert.deepEqual(new Set(LIVE_POINTS_V2_ROOT_FIELDS), new Set([
			'calcLivePointsByEntry',
			'calcLivePointsForEntries',
			'liveScores',
			'playerLive',
			'eventLive',
			'eventLiveExplain',
			'eventLiveExplains',
			'liveSnapshot',
			'liveContext',
			'entryLiveCompetitionBoard',
			'leagueLiveHead',
			'tournamentOfficialH2H',
			'tournamentOfficialH2HHistory',
			'tournamentSelectionIndex',
			'tournamentEntrySquads',
			'tournamentDetailDesk',
			'gameweekDesk',
			'homeGameweek'
		]))
		for (const document of [
			GET_GAMEWEEK_DESK,
			GET_HOME_GAMEWEEK,
			GET_TOURNAMENT_DETAIL_DESK
		]) {
			assert.equal(requiresLivePointsV2Contract(document), true)
			assert.equal(
				liveContractVersionForQuery(document),
				LIVE_POINTS_CONTRACT_VERSION
			)
		}
	})

	it('keeps live matches on their separate breaking contract', () => {
		const matchdayQuery = 'query LiveMatchday { liveMatchday { availability } }'
		assert.equal(requiresLiveMatchesV3Contract(matchdayQuery), true)
		assert.equal(requiresLivePointsV2Contract(matchdayQuery), false)
		assert.equal(LIVE_MATCHES_CONTRACT_VERSION, 'live-matches-v3')
		assert.equal(LIVE_POINTS_CONTRACT_VERSION, 'live-points-v2')
		assert.equal(liveContractVersionForQuery(matchdayQuery), 'live-matches-v3')
		assert.throws(
			() =>
				liveContractVersionForQuery(
					'query Mixed { liveMatchday { availability } liveContext { season } }'
				),
			/LIVE_CONTRACT_MIXED_OPERATION/
		)
	})

	it('keeps server competition routes on V2 and preserves upgrade failures', () => {
		for (const route of [
			'board/route.ts',
			'head/route.ts',
			'compare/route.ts',
			'selection-index/route.ts'
		]) {
			const source = readFileSync(
				new URL(`../app/api/live/competitions/[id]/${route}`, import.meta.url),
				'utf8'
			)
			assert.match(source, /contract: 'live-points-v2'/)
			assert.match(source, /status === 426/)
			assert.match(source, /CLIENT_UPGRADE_REQUIRED/)
		}
	})

	it('requests only V2 fields and keeps duplicate score aliases out of the document', () => {
		assert.match(GET_LIVE_POINTS, /score\s*\{/)
		assert.match(GET_LIVE_POINTS, /revisions\s*\{/)
		assert.match(GET_LIVE_POINTS, /sourceCheckedAt/)
		assert.match(GET_LIVE_POINTS, /contentUpdatedAt/)
		assert.match(GET_LIVE_POINTS, /delivery\s*\{/)
		assert.doesNotMatch(
			GET_LIVE_POINTS,
			/LINEUP_UNAVAILABLE|liveNetPoints|liveTotalPoints/
		)
		assert.doesNotMatch(GET_LIVE_POINTS, /checkedAt\b|\brevision\b(?!\s*\n)/)
	})

	it('treats heartbeat-only changes as metadata and score revision changes as reloads', () => {
		const accepted = {
			season: '2627',
			eventId: 1,
			state: 'LIVE_ACTIVE' as const,
			scoreCoreRevision: revision('a')
		}
		assert.equal(
			liveSnapshotNeedsRefresh(accepted, {
				...accepted,
				sourceCheckedAt: '2026-08-29T10:00:30.000Z'
			}),
			false
		)
		assert.equal(
			liveSnapshotNeedsRefresh(accepted, {
				...accepted,
				scoreCoreRevision: revision('b')
			}),
			true
		)
		assert.equal(
			liveSnapshotNeedsRefresh(
				{
					...accepted,
					revisions: {
						...score().revisions,
						scoreCore: revision('a'),
						picksBase: revision('p')
					}
				},
				{
					...accepted,
					revisions: {
						...score().revisions,
						scoreCore: revision('a'),
						picksBase: revision('q')
					}
				}
			),
			true
		)
	})

	it('never replaces an accepted publication with an older same-event fallback', () => {
		const accepted = liveContextToSnapshot({
			season: '2627',
			eventId: 1,
			anchorEventId: 1,
			latestFinalizedEventId: null,
			nextEventId: 2,
			scoreCoreRevision: revision('b'),
			state: 'LIVE_ACTIVE',
			windowState: 'LIVE_ACTIVE',
			producerState: 'LIVE_ACTIVE',
			anchorMode: 'CURRENT',
			dataAvailability: 'FRESH',
			source: 'REDIS_CURRENT',
			stale: false,
			publishedAt: '2026-08-29T10:01:00.000Z',
			sourceCheckedAt: '2026-08-29T10:01:01.000Z',
			nextRefreshAt: null,
			revisions: { ...score().revisions, generation: 2 },
			times: score().times,
			delivery: score().delivery
		})
		const older = {
			...accepted!,
			publishedAt: '2026-08-29T10:00:00.000Z',
			revisions: { ...accepted!.revisions!, generation: 1 }
		}
		const newer = {
			...accepted!,
			revisions: { ...accepted!.revisions!, generation: 3 }
		}

		assert.equal(canReplaceLivePointsSnapshot(older, accepted), false)
		assert.equal(canReplaceLivePointsSnapshot(accepted, accepted), true)
		assert.equal(canReplaceLivePointsSnapshot(newer, accepted), true)
		assert.equal(
			canReplaceLivePointsSnapshot({ ...newer, eventId: 2 }, accepted),
			false
		)
	})

	it('clears a context snapshot before loading a different historical event', () => {
		assert.equal(livePointsRequestChangesEvent(1, 2), true)
		assert.equal(livePointsRequestChangesEvent(1, 1), false)
		assert.equal(livePointsRequestChangesEvent(undefined, 2), false)
	})

	it('re-probes official lifecycle before fetching after returning to current GW', () => {
		const hook = readFileSync(
			new URL('../app/live/points/_hooks/useLivePoints.ts', import.meta.url),
			'utf8'
		)
		assert.match(hook, /refreshOfficialSyncStateForCurrentEvent/)
		assert.match(
			hook,
			/const selectingCurrentGameweek =\s*gameweek === currentGameweekRef\.current/
		)
		assert.match(
			hook,
			/await refreshOfficialSyncStateForCurrentEvent\(\s*gameweek\s*\)/
		)
		assert.match(
			hook,
			/officialSyncPendingRef\.current = shouldKeepSyncPending/
		)
		assert.match(hook, /gameweekSelectionRef\.current/)
	})

	it('scopes official sync error suppression to the active event', () => {
		assert.equal(shouldSuppressOfficialLiveErrors(1, 1, true, false), true)
		assert.equal(shouldSuppressOfficialLiveErrors(2, 1, true, false), false)
		assert.equal(shouldSuppressOfficialLiveErrors(2, 1, false, true), false)
		assert.equal(shouldSuppressOfficialLiveErrors(1, 1, false, true), true)
	})

	it('re-probes official sync when returning from a historical gameweek', () => {
		const hook = readFileSync(
			new URL('../app/live/points/_hooks/useLivePoints.ts', import.meta.url),
			'utf8'
		)
		assert.match(hook, /refreshOfficialSyncStateForCurrentEvent/)
		assert.match(
			hook,
			/if \(selectingCurrentGameweek\)[\s\S]*refreshOfficialSyncStateForCurrentEvent\(gameweek\)/
		)
		assert.match(hook, /cache: 'no-store',[\s\S]*suppressErrorLog: true/)
	})

	it('does not turn a due refresh deadline into a full Live Points reload', () => {
		const hook = readFileSync(
			new URL('../app/live/points/_hooks/useLivePoints.ts', import.meta.url),
			'utf8'
		)
		const tournament = readFileSync(
			new URL(
				'../app/live/tournaments/TournamentClient.tsx',
				import.meta.url
			),
			'utf8'
		)
		assert.doesNotMatch(hook, /liveScoreDue/)
		assert.doesNotMatch(tournament, /liveScoreDue/)
		assert.match(
			hook,
			/if \(!liveSnapshotNeedsRefresh\(snapshotRef\.current, observedSnapshot\)\)/
		)
		assert.match(tournament, /fetchLeagueLiveHead/)
		assert.match(tournament, /liveBoardPublicationChanged/)
		assert.match(tournament, /shouldAutoRefreshLiveBoardPage\(boardPage\)/)
	})

	it('preserves the same event while polling only the active event', () => {
		assert.equal(LIVE_AUTO_REFRESH_SECONDS, 30)
		const snapshot = {
			season: '2627',
			eventId: 1,
			state: 'LIVE_ACTIVE' as const,
			scoreCoreRevision: revision('a')
		}
		assert.equal(
			shouldPollLiveSnapshot({
				isPageActive: true,
				currentEventId: 1,
				selectedEventId: 1,
				snapshot
			}),
			true
		)
		assert.equal(
			shouldPollLiveSnapshot({
				isPageActive: true,
				currentEventId: 2,
				selectedEventId: 1,
				snapshot
			}),
			false
		)
	})

	it('maps delivery timestamps without using source checks as content revisions', () => {
		const snapshot = liveContextToSnapshot({
			season: '2627',
			eventId: 1,
			anchorEventId: 1,
			latestFinalizedEventId: null,
			nextEventId: 2,
			scoreCoreRevision: revision('a'),
			state: 'LIVE_ACTIVE',
			windowState: 'LIVE_ACTIVE',
			producerState: 'LIVE_ACTIVE',
			anchorMode: 'CURRENT',
			dataAvailability: 'FRESH',
			source: 'REDIS_CURRENT',
			stale: false,
			publishedAt: '2026-08-29T10:00:00.000Z',
			sourceCheckedAt: '2026-08-29T10:00:01.000Z',
			nextRefreshAt: null,
			revisions: score().revisions,
			times: score().times,
			delivery: score().delivery
		})
		assert.equal(snapshot?.eventId, 1)
		assert.equal(snapshot?.scoreCoreRevision, revision('a'))
	})

	it('accepts only traceable V2 projected scores', () => {
		const value = traceableLiveScore(score())
		assert.ok(value)
		assert.equal(liveScoreAuthorityLabel(value), '预计')
		assert.equal(
			traceableLiveScore(
				score({
					delivery: {
						state: 'UNAVAILABLE',
						servedFrom: 'PROCESS_LKG',
						reasonCodes: []
					}
				})
			),
			undefined
		)
	})
})
