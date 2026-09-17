import type {
 LeagueLiveHead,
 TournamentOfficialH2H,
 TournamentOfficialH2HLiveMatch,
 TournamentOfficialH2HLiveMatchSide,
} from '../../lib/graphql/operations/tournaments'

// Isolated J08 data: a real matchup plus an average/bye opponent, across two rounds.
export function officialH2HFixture(eventId: 3 | 4, tournamentId = 6) {
 const stamp = '2026-09-01T00:00:00.000Z'
 const revision = String(eventId).repeat(64)
 const revisions = {
  publicationId: `h2h-fixture-${tournamentId}-${eventId}`, generation: eventId,
  roster: revision, scoreCore: revision, fixtureIdentity: revision,
  entryInputSet: revision, identity: revision, officialRank: revision,
  rules: revision, algorithm: 'fixture-v1', content: revision,
 }
 const times = { sourceCheckedAt: stamp, contentUpdatedAt: stamp, publishedAt: stamp,
  checkpointedAt: stamp, servedAt: stamp, staleAt: '2099-01-01T00:00:00.000Z', nextRefreshAt: null }
 const delivery = { state: 'FINAL', servedFrom: 'FINAL_RESULT', reasonCodes: [] } as const
 const side = (entryId: number | null, entryName: string, points: number): TournamentOfficialH2HLiveMatchSide => ({
  availability: 'READY', entryId, entryName, playerName: entryId ? `Manager ${entryId}` : null,
  isAverage: entryId === null, points, netPoints: points,
 })
 const home = side(123, 'H2H Home United', eventId === 3 ? 54 : 60)
 const away = side(456, 'H2H Away United', eventId === 3 ? 61 : 55)
 const third = side(789, 'H2H Bye United', 58)
 const match = (order: number, left: TournamentOfficialH2HLiveMatchSide, right: TournamentOfficialH2HLiveMatchSide): TournamentOfficialH2HLiveMatch => ({
  officialMatchId: eventId * 100 + order + 1, eventId, groupId: 1, sourceOrder: order,
  phase: 'REGULAR', knockoutName: null, tiebreak: null, isBye: right.isAverage,
  availability: 'READY', delivery: { ...delivery, reasonCodes: [] }, revisions,
  times, home: left, away: right,
 })
 const snapshot: TournamentOfficialH2H = {
  eventId, availability: 'READY', delivery: { ...delivery, reasonCodes: [] }, revisions, times,
  standings: { throughEventId: eventId, state: 'READY', sourceCheckedAt: stamp,
   rows: [home, away, third].map((entry, index) => ({ entryId: entry.entryId!, entryName: entry.entryName,
    playerName: entry.playerName, rank: index + 1, matchPoints: (3 - index) * 3,
    played: 3, won: 3 - index, drawn: 0, lost: index, pointsFor: entry.points! * 3 })) },
  matches: [match(0, home, away), match(1, third, side(null, 'Average', 50))],
 }
 const head: LeagueLiveHead = { season: '2026/27', tournamentId, eventId, mode: 'H2H',
  availability: 'READY', contentRevision: revision, publication: { revisions, times },
  delivery: { ...delivery, reasonCodes: [] }, nextRefreshAt: null }
 return { snapshot, head }
}
