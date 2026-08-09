import type { EntryEventPick } from '@/lib/graphql/operations/entries'
import type {
	PublicLeagueTrend,
} from '@/lib/graphql/operations/leagues'
import type { TournamentStatPlayer } from '@/lib/graphql/operations/tournaments'

export type LeagueTrendsScope = 'mine' | 'public'

export type InitialLeagueTrendsSelection = {
	scope: LeagueTrendsScope | null
	tournamentId: number | null
	key: string | null
	gameweek: number
	urlSelectionValid: boolean
}

const positiveInteger = (value: string | number | null | undefined): number | null => {
	const parsed = Number(value)
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function leagueTrendKey(scope: LeagueTrendsScope, tournamentId: number): string {
	return `${scope}:${tournamentId}`
}

export function resolveInitialLeagueTrendsSelection(opts: {
	scopeParam?: string | null
	tournamentParam?: string | null
	gwParam?: string | null
	mineTournamentIds: number[]
	publicLeagues: PublicLeagueTrend[]
	defaultGameweek: number
}): InitialLeagueTrendsSelection {
	const requestedScope =
		opts.scopeParam === 'mine' || opts.scopeParam === 'public'
			? opts.scopeParam
			: null
	const requestedTournament = positiveInteger(opts.tournamentParam)
	const requestedGw = positiveInteger(opts.gwParam)
	const requestedExists =
		requestedScope === 'mine'
			? requestedTournament != null &&
				opts.mineTournamentIds.includes(requestedTournament)
			: requestedScope === 'public'
				? requestedTournament != null &&
					opts.publicLeagues.some(
						league => league.tournamentId === requestedTournament,
					)
				: false

	if (requestedScope && requestedTournament && requestedExists) {
		return {
			scope: requestedScope,
			tournamentId: requestedTournament,
			key: leagueTrendKey(requestedScope, requestedTournament),
			gameweek:
				requestedGw != null && requestedGw <= 38
					? requestedGw
					: opts.defaultGameweek,
			urlSelectionValid: true,
		}
	}

	const firstMine = opts.mineTournamentIds[0]
	if (firstMine != null) {
		return {
			scope: 'mine',
			tournamentId: firstMine,
			key: leagueTrendKey('mine', firstMine),
			gameweek: opts.defaultGameweek,
			urlSelectionValid: false,
		}
	}

	const firstPublic = opts.publicLeagues[0]
	if (firstPublic) {
		return {
			scope: 'public',
			tournamentId: firstPublic.tournamentId,
			key: leagueTrendKey('public', firstPublic.tournamentId),
			gameweek: firstPublic.latestAvailableEventId || opts.defaultGameweek,
			urlSelectionValid: false,
		}
	}

	return {
		scope: null,
		tournamentId: null,
		key: null,
		gameweek: opts.defaultGameweek,
		urlSelectionValid: false,
	}
}

export type LeagueExposure = {
	player: TournamentStatPlayer
	userMultiplier: number
	effectiveOwnership: number
	gap: number
}

export type LeagueTrendSummary = {
	templateCore: TournamentStatPlayer[]
	templateOwnedCount: number
	userCaptain: EntryEventPick | null
	captainRate: number | null
	captainExposure: LeagueExposure | null
	biggestNegative: LeagueExposure | null
	biggestPositive: LeagueExposure | null
	rolesByPlayerId: Map<number, Array<'OWNED' | 'CAPTAIN' | 'VICE'>>
}

export function buildLeagueTrendSummary(
	selection: TournamentStatPlayer[],
	captaincy: TournamentStatPlayer[],
	picks: EntryEventPick[],
): LeagueTrendSummary {
	const topTwelve = selection.slice(0, 12)
	const pickByPlayerId = new Map<number, EntryEventPick>()
	const rolesByPlayerId = new Map<
		number,
		Array<'OWNED' | 'CAPTAIN' | 'VICE'>
	>()
	for (const pick of picks) {
		const playerId = positiveInteger(pick.element)
		if (playerId == null) continue
		pickByPlayerId.set(playerId, pick)
		const roles: Array<'OWNED' | 'CAPTAIN' | 'VICE'> = ['OWNED']
		if (pick.isCaptain) roles.push('CAPTAIN')
		if (pick.isViceCaptain) roles.push('VICE')
		rolesByPlayerId.set(playerId, roles)
	}

	const exposures = topTwelve.flatMap(player => {
		const effectiveOwnership = player.eoByPercent
		if (effectiveOwnership == null || !Number.isFinite(effectiveOwnership)) return []
		const userMultiplier = pickByPlayerId.get(player.id)?.multiplier ?? 0
		return [
			{
				player,
				userMultiplier,
				effectiveOwnership,
				gap: userMultiplier - effectiveOwnership / 100,
			},
		]
	})
	const userCaptain = picks.find(pick => pick.isCaptain) ?? null
	const captainId = positiveInteger(userCaptain?.element)
	const captainRate =
		captainId == null
			? null
			: captaincy.find(player => player.id === captainId)?.captainByPercent ?? null
	const captainExposure =
		captainId == null
			? null
			: exposures.find(exposure => exposure.player.id === captainId) ?? null

	return {
		templateCore: topTwelve.slice(0, 5),
		templateOwnedCount: topTwelve
			.slice(0, 5)
			.filter(player => pickByPlayerId.has(player.id)).length,
		userCaptain,
		captainRate,
		captainExposure,
		biggestNegative:
			exposures.filter(exposure => exposure.gap < 0).sort((a, b) => a.gap - b.gap)[0] ??
			null,
		biggestPositive:
			exposures.filter(exposure => exposure.gap > 0).sort((a, b) => b.gap - a.gap)[0] ??
			null,
		rolesByPlayerId,
	}
}
