import type { Player } from '@/types/player'
import type { SquadPitchPlayer, SquadTeamCode } from '@/components/squad-pitch/SquadPitch'

const TEAM_CODE_BY_ALIAS: Record<string, SquadTeamCode> = {
	ARS: 'ARS',
	ARSENAL: 'ARS',
	AVL: 'AVL',
	'ASTON VILLA': 'AVL',
	BOU: 'BOU',
	BOURNEMOUTH: 'BOU',
	BRE: 'BRE',
	BRENTFORD: 'BRE',
	BHA: 'BHA',
	BRIGHTON: 'BHA',
	CHE: 'CHE',
	CHELSEA: 'CHE',
	COV: 'COV',
	COVENTRY: 'COV',
	CRY: 'CRY',
	'CRYSTAL PALACE': 'CRY',
	EVE: 'EVE',
	EVERTON: 'EVE',
	FUL: 'FUL',
	FULHAM: 'FUL',
	HUL: 'HUL',
	'HULL CITY': 'HUL',
	IPS: 'IPS',
	IPSWICH: 'IPS',
	LEE: 'LEE',
	LEEDS: 'LEE',
	LIV: 'LIV',
	LIVERPOOL: 'LIV',
	MCI: 'MCI',
	'MAN CITY': 'MCI',
	'MANCHESTER CITY': 'MCI',
	MUN: 'MUN',
	'MAN UNITED': 'MUN',
	'MANCHESTER UNITED': 'MUN',
	NEW: 'NEW',
	NEWCASTLE: 'NEW',
	'NEWCASTLE UNITED': 'NEW',
	NFO: 'NFO',
	'NOTTINGHAM FOREST': 'NFO',
	SUN: 'SUN',
	SUNDERLAND: 'SUN',
	TOT: 'TOT',
	TOTTENHAM: 'TOT',
	'TOTTENHAM HOTSPUR': 'TOT',
}

function resolveTeamCode(player: Player): SquadTeamCode | null {
	const aliases = [player.teamShort, player.team]
		.map(value => value.trim().toUpperCase())
		.filter(Boolean)

	for (const alias of aliases) {
		const teamCode = TEAM_CODE_BY_ALIAS[alias]
		if (teamCode) return teamCode
	}

	return null
}

export function mapPlayersToSquadPitch(
	players: readonly Player[]
): SquadPitchPlayer[] {
	return players.flatMap(player => {
		const teamCode = resolveTeamCode(player)
		if (!teamCode) return []

		return [{
			id: player.id,
			webName: player.name,
			score: player.stats.points,
			teamCode,
			position: player.position,
			isCaptain: player.isCaptain,
			isViceCaptain: player.isViceCaptain,
		}]
	})
}
