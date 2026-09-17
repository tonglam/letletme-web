import type { MyFplManagerGameweek, MyFplManagerReview, MyFplSnapshotMeta, MyFplManagerTimelineRow, MyFplManagerPick } from '../../lib/graphql/operations/my-fpl'

const context = { season: '2026/27', coreRevision: 'manager-fixture-core', currentEventId: 3, nextEventId: 4, latestFinalizedEventId: 3, latestPublishedEventId: 3 }
const entry = { id: 15702, entryName: 'E2E Review United', playerName: 'Review Manager', region: 'Australia', startedEvent: 1, overallPoints: 180, overallRank: 900, bank: 10, teamValue: 1000, totalTransfers: 5 }
const stamp = '2026-09-01T00:00:00.000Z'
export function managerSnapshot(eventId: number): MyFplSnapshotMeta {
 return { revision: String(100 + eventId), eventId, snapshotDate: '2026-09-01', sourceCheckedAt: stamp, publishedAt: stamp, settlementState: 'FINAL', coverageState: 'COMPLETE', timelinessState: 'CURRENT', expectedEntryCount: 1, observedEntryCount: 1, finalizationStartedAt: null, finalizationDueAt: null, scoreSource: 'FPL_FINAL_RESULT', livePublicationId: null, liveRevision: null, algorithmVersion: null, sourceMinCheckedAt: stamp, sourceMaxCheckedAt: stamp }
}
const decision = { formation: '4-4-2', lineupBasePoints: 50, bestElevenPoints: 50, benchRegretPoints: 0, positionPoints: { goalkeeper: 4, defender: 16, midfielder: 20, forward: 10, assistantManager: 0, total: 50 }, captain: { captainElement: 1, captainWebName: 'Saka', captainTeamShortName: 'ARS', captainBasePoints: 10, captainContribution: 20, viceCaptainElement: 16, viceCaptainWebName: 'Review Player 7', viceCaptainBasePoints: 4, bestSquadElement: 1, bestSquadWebName: 'Saka', bestSquadPoints: 10, regretPoints: 0 }, automaticSubstitutions: [] }
const timeline: MyFplManagerTimelineRow[] = [1, 2, 3].map(eventId => ({ eventId, status: 'FINAL', eventPoints: 60, eventRank: 1000, overallPoints: eventId * 60, overallRank: 1200 - eventId * 100, overallRankDelta: 100, eventTransfers: eventId === 1 ? 1 : 2, eventTransfersCost: 0, eventNetPoints: 60, eventBenchPoints: 4, eventAutoSubPoints: 0, eventChip: ['NONE', 'WILDCARD', 'FREE_HIT'][eventId - 1], eventCaptainPoints: 20, captainWebName: 'Saka', captainTeamShortName: 'ARS', teamValue: 1000, bank: 10, review: decision }))
const picks: MyFplManagerPick[] = [4, 4, 4, 4, 4, 10, 4, 3, 3, 5, 5, 1, 1, 1, 1].map((points, index) => ({
 element: index === 5 ? 1 : index + 10, position: index + 1,
 webName: index === 5 ? 'Saka' : `Review Player ${index + 1}`, teamShortName: 'ARS', teamName: 'Arsenal',
 elementTypeName: index === 0 || index === 11 ? 'GOALKEEPER' : index < 5 || index === 12 ? 'DEFENDER' : index < 9 || index === 13 ? 'MIDFIELDER' : 'FORWARD',
 isCaptain: index === 5, isViceCaptain: index === 6, multiplier: index > 10 ? 0 : index === 5 ? 2 : 1,
 totalPoints: points, minutes: 90, goalsScored: 0, assists: 0, cleanSheets: 0, goalsConceded: 0,
 yellowCards: 0, redCards: 0, saves: 0, bonus: 0, bps: 0, againstShortName: 'CHE', wasHome: 'H',
 score: '1-0', fixtureCount: 1, bgw: false, dgw: false, isPlayed: true, autoSub: false,
 expectedGoals: null, expectedAssists: null, expectedGoalInvolvements: null, expectedGoalsConceded: null
}))
export function managerGameweek(eventId: number): MyFplManagerGameweek {
 const row = timeline.find(value => value.eventId === eventId)
 if (!row) throw new Error(`Unsupported manager fixture GW ${eventId}`)
 return { state: 'READY', context, eventId, entry, result: { ...row, playedCaptainWebName: 'Saka', playedCaptainTeamShortName: 'ARS', picks }, review: decision, snapshotMeta: managerSnapshot(eventId) }
}
export const managerReview: MyFplManagerReview = {
 state: 'READY', context, entry, throughEventId: 3, timeline,
 summary: { gameweeksReviewed: 3, provisionalGameweeks: 0, totalNetPoints: 180, averageNetPoints: 60, medianNetPoints: 60, bestGameweekId: 1, bestNetPoints: 60, worstGameweekId: 1, worstNetPoints: 60, totalHitPoints: 0, hitGameweeks: 0, totalBenchPoints: 12, averageBenchPoints: 4, zeroBenchGameweeks: 0, highBenchGameweeks: 0, totalAutoSubPoints: 0, autoSubGameweeks: 0, totalCaptainPoints: 60, uniqueCaptains: 1, captainBlankGameweeks: 0, topCaptainWebName: 'Saka', topCaptainGameweeks: 3, topCaptainRate: 1, bestOverallRank: 900, worstOverallRank: 1100, overallRankChange: 200, currentImprovementStreak: 2, longestImprovementStreak: 2, formations: [{ formation: '4-4-2', gameweeks: 3 }], positionPoints: { goalkeeper: 12, defender: 48, midfielder: 60, forward: 30, assistantManager: 0, total: 150 }, chips: timeline.filter(row => row.eventId > 1).map(row => ({ chip: row.eventChip, eventId: row.eventId, status: 'FINAL', eventNetPoints: 60, otherGameweeksAverageNetPoints: 60, differenceFromOtherGameweeks: 0, overallRankDelta: 100 })) },
 holdings: [], transfers: timeline.map(row => ({ eventId: row.eventId, eventTransfers: row.eventTransfers, eventTransfersCost: 0, transfers: Array.from({ length: row.eventTransfers }, (_, index) => ({ eventId: row.eventId, elementIn: 101 + index, elementInWebName: `Incoming ${row.eventId}-${index + 1}`, elementInTypeName: 'MIDFIELDER', elementInTeamShortName: 'ARS', elementInCost: 60, elementInPoints: 6, elementInPlayed: true, elementOut: 201 + index, elementOutWebName: `Outgoing ${row.eventId}-${index + 1}`, elementOutTypeName: 'MIDFIELDER', elementOutTeamShortName: 'CHE', elementOutCost: 60, elementOutPoints: 2, sameGameweekGain: 4, threeGameweekGain: null, fiveGameweekGain: null, evaluatedThroughEventId: row.eventId, time: stamp })) })),
 pastSeasons: [{ season: '2025/26', totalPoints: 2400, overallRank: 12000 }], pastSeasonsState: 'READY', currentGameweek: managerGameweek(3), rules: null, snapshotMeta: managerSnapshot(3)
}
