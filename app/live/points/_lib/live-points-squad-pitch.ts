import type { SquadPitchPlayer } from '@/components/squad-pitch/SquadPitch'
import { resolveSquadTeamCode } from '@/lib/squad-pitch-team-codes'
import type { Player } from '@/types/player'

export function mapPlayersToSquadPitch(
	players: readonly Player[]
): SquadPitchPlayer[] {
	return players.map(player => {
		const teamShort =
			typeof player.teamShort === 'string' ? player.teamShort : ''
		const teamName = typeof player.team === 'string' ? player.team : ''
		const teamCode = resolveSquadTeamCode(teamShort, teamName)
		const teamBadgeLabel =
			teamShort.trim().toUpperCase() || teamName.trim().slice(0, 3).toUpperCase()

		return {
			id: player.id,
			webName: player.name,
			score: player.stats.points,
			...(teamCode ? { teamCode } : { teamBadgeLabel }),
			position: player.position,
			isCaptain: player.isCaptain,
			isViceCaptain: player.isViceCaptain,
		}
	})
}
