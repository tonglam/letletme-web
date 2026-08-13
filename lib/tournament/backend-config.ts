type TournamentApiEnv = {
	LETLETME_DATA_URL?: string
	LETLETME_DATA_API_KEY?: string
	TOURNAMENT_API_BASE_URL?: string
	TOURNAMENT_API_KEY?: string
}

/**
 * Resolve the Data API settings while older production deployments migrate
 * from the original tournament variable names.
 */
export const getConfiguredTournamentApiBaseUrl = (
	env: TournamentApiEnv = process.env as TournamentApiEnv
): string =>
	env.LETLETME_DATA_URL?.trim() || env.TOURNAMENT_API_BASE_URL?.trim() || ''

export const getConfiguredTournamentApiKey = (
	env: TournamentApiEnv = process.env as TournamentApiEnv
): string =>
	env.LETLETME_DATA_API_KEY?.trim() || env.TOURNAMENT_API_KEY?.trim() || ''
