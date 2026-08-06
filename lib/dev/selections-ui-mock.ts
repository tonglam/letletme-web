/**
 * TEMP data mock for /data/selections UI review.
 *
 * Flip `SELECTIONS_UI_MOCK_ENABLED` to false (or delete this file + call sites).
 */
import type { EntryTournament, TournamentStatPlayer } from '@/lib/graphql/operations/tournaments'
import { getTournamentStatsUiMockTournament } from '@/lib/dev/tournament-stats-ui-mock'
import { mapEntryTournamentToLiveTournament } from '@/lib/tournament/liveTournament'
import type { Tournament } from '@/types/tournament'

/** Flip to false (or delete the file) to turn the mock off. */
export const SELECTIONS_UI_MOCK_ENABLED = true

export const SELECTIONS_MOCK_EVENT_ID = 28
export const SELECTIONS_MOCK_ENTRY_ID = 1

export function getSelectionsUiMockTournaments(): Tournament[] {
	const entry = getTournamentStatsUiMockTournament(SELECTIONS_MOCK_ENTRY_ID)
	const second: EntryTournament = {
		...entry,
		id: 1002,
		name: 'Family Mini-League',
		totalTeamNum: 6,
	}
	return [entry, second].map(mapEntryTournamentToLiveTournament)
}

function player(
	id: number,
	webName: string,
	teamShortName: string,
	position: string,
	selectedByPercent: number,
	extra?: Partial<TournamentStatPlayer>,
): TournamentStatPlayer {
	return {
		id,
		webName,
		teamShortName,
		position,
		selectedByPercent,
		...extra,
	}
}

export function getSelectionsUiMockStats(): {
	selection: TournamentStatPlayer[]
	captain: TournamentStatPlayer[]
	transferIn: TournamentStatPlayer[]
	transferOut: TournamentStatPlayer[]
} {
	return {
		selection: [
			player(351, 'Salah', 'LIV', 'MIDFIELDER', 92.4, { eoByPercent: 118.2 }),
			player(10, 'Haaland', 'MCI', 'FORWARD', 78.1, { eoByPercent: 91.5 }),
			player(131, 'Palmer', 'CHE', 'MIDFIELDER', 71.3, { eoByPercent: 76.0 }),
			player(7, 'Saka', 'ARS', 'MIDFIELDER', 64.8, { eoByPercent: 68.2 }),
			player(2, 'Saliba', 'ARS', 'DEFENDER', 58.2, { eoByPercent: 59.1 }),
			player(1, 'Raya', 'ARS', 'GOALKEEPER', 51.0, { eoByPercent: 51.0 }),
			player(11, 'Isak', 'NEW', 'FORWARD', 44.6, { eoByPercent: 48.3 }),
			player(8, 'Mbeumo', 'BRE', 'MIDFIELDER', 39.2, { eoByPercent: 40.1 }),
		],
		captain: [
			player(351, 'Salah', 'LIV', 'MIDFIELDER', 62.1, {
				captainByPercent: 54.2,
				eoByPercent: 118.2,
			}),
			player(10, 'Haaland', 'MCI', 'FORWARD', 55.0, {
				captainByPercent: 28.4,
				eoByPercent: 91.5,
			}),
			player(131, 'Palmer', 'CHE', 'MIDFIELDER', 48.2, {
				captainByPercent: 9.1,
				eoByPercent: 76.0,
			}),
			player(7, 'Saka', 'ARS', 'MIDFIELDER', 39.4, {
				captainByPercent: 4.8,
				eoByPercent: 68.2,
			}),
			player(11, 'Isak', 'NEW', 'FORWARD', 28.7, {
				captainByPercent: 3.5,
				eoByPercent: 48.3,
			}),
		],
		transferIn: [
			player(131, 'Palmer', 'CHE', 'MIDFIELDER', 48.2, { transfersEvent: 4 }),
			player(11, 'Isak', 'NEW', 'FORWARD', 28.7, { transfersEvent: 3 }),
			player(8, 'Mbeumo', 'BRE', 'MIDFIELDER', 39.2, { transfersEvent: 3 }),
			player(7, 'Saka', 'ARS', 'MIDFIELDER', 39.4, { transfersEvent: 2 }),
			player(3, 'Virgil', 'LIV', 'DEFENDER', 22.0, { transfersEvent: 2 }),
		],
		transferOut: [
			player(20, 'Watkins', 'AVL', 'FORWARD', 18.4, { transfersEvent: 5 }),
			player(24, 'Foden', 'MCI', 'MIDFIELDER', 25.6, { transfersEvent: 4 }),
			player(22, 'Gordon', 'NEW', 'MIDFIELDER', 15.2, { transfersEvent: 3 }),
			player(21, 'Solanke', 'TOT', 'FORWARD', 12.1, { transfersEvent: 2 }),
			player(23, 'Jackson', 'CHE', 'FORWARD', 10.4, { transfersEvent: 2 }),
		],
	}
}
