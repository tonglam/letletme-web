import type { PlayerDirectoryOption } from '@/components/player/PlayerDirectoryPicker'

export const RECENT_PLAYERS_MAX = 5

function isPlayerDirectoryOption(
	value: unknown
): value is PlayerDirectoryOption {
	if (!value || typeof value !== 'object') return false
	const player = value as Partial<PlayerDirectoryOption>
	return (
		typeof player.id === 'string' &&
		typeof player.name === 'string' &&
		typeof player.position === 'string' &&
		typeof player.teamShortName === 'string' &&
		typeof player.teamName === 'string'
	)
}

export function parseRecentPlayers(
	raw: string | null
): PlayerDirectoryOption[] {
	if (!raw) return []
	try {
		const parsed: unknown = JSON.parse(raw)
		if (!Array.isArray(parsed) || !parsed.every(isPlayerDirectoryOption))
			return []
		return parsed.slice(0, RECENT_PLAYERS_MAX)
	} catch {
		return []
	}
}

export function serializeRecentPlayers(
	players: readonly PlayerDirectoryOption[]
): string {
	return JSON.stringify(players.slice(0, RECENT_PLAYERS_MAX))
}
