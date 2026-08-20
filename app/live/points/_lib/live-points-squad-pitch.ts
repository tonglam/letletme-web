import type { SquadPitchPlayer } from '@/components/squad-pitch/SquadPitch'
import { resolveSquadTeamCode } from '@/lib/squad-pitch-team-codes'
import type { Player } from '@/types/player'

export function mapPlayersToSquadPitch(
	players: readonly Player[]
): SquadPitchPlayer[] {
	return players.map(player => {
		const teamCode = resolveSquadTeamCode(player.teamShort, player.team)
		const teamBadgeLabel =
			player.teamShort.trim().toUpperCase() ||
			player.team.trim().slice(0, 3).toUpperCase()

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
