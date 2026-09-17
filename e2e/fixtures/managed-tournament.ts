import type { EntryTournament } from '../../lib/graphql/operations/tournaments'
const stamp = '2026-09-01T00:00:00.000Z'
export const managedTournament: EntryTournament = {
 id: 77, name: 'J12 Owned Cup', creator: 'Fixture Owner', adminEntryId: 909090,
 leagueId: 77, leagueType: 'CLASSIC', sourceLeagueName: 'Fixture League', totalTeamNum: 2,
 tournamentMode: 'CLASSIC', groupMode: 'POINTS_RACES', groupTeamNum: 2, groupNum: 1,
 groupStartedEventId: 1, groupEndedEventId: 38, groupAutoAverages: false,
 groupRounds: 1, groupPlayAgainstNum: null, groupQualifyNum: null,
 knockoutMode: 'NONE', knockoutTeamNum: null, knockoutRounds: null, knockoutEventNum: null,
 knockoutStartedEventId: null, knockoutEndedEventId: null, knockoutPlayAgainstNum: null,
 state: 'ACTIVE', rosterMode: 'SNAPSHOT', rosterSyncStatus: 'READY', rosterLastSyncedAt: stamp,
 officialScheduleHash: null, officialScheduleSyncedAt: null, officialScheduleLockedAt: null,
 setupStatus: 'READY', setupPhase: 'READY', setupCompletedUnits: 2, setupTotalUnits: 2,
 setupProgressUpdatedAt: stamp, standingsReadyAt: stamp, profilesReadyAt: stamp,
 insightsReadyAt: stamp, setupHasWarnings: false, warningSummaries: [],
 setupStartedAt: stamp, setupFinishedAt: stamp, createdAt: stamp, updatedAt: stamp,
}
