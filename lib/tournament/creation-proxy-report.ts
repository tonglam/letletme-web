import {
	publicTournamentErrorCode,
	type PublicTournamentErrorCode
} from './public-response'

export type TournamentCreationProxyOutcome =
	'success' | 'upstream_rejected' | 'rejected' | 'timeout' | 'unavailable'

export type TournamentCreationProxyReport = {
	event: 'tournament_creation_proxy'
	outcome: TournamentCreationProxyOutcome
	durationMs: number
	responseStatus: number
	tournamentId: number | null
	setupStatus: 'pending' | 'processing' | 'ready' | 'failed' | null
	failureCode: PublicTournamentErrorCode | null
}

const SETUP_STATUSES = new Set(['pending', 'processing', 'ready', 'failed'])

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function extractTournamentCreationResult(
	result: unknown
): Pick<TournamentCreationProxyReport, 'tournamentId' | 'setupStatus'> {
	if (!isRecord(result)) return { tournamentId: null, setupStatus: null }
	const tournament = isRecord(result.tournament) ? result.tournament : null
	const rawTournamentId = tournament?.id
	const rawSetupStatus = result.setupStatus
	return {
		tournamentId:
			typeof rawTournamentId === 'number' &&
			Number.isSafeInteger(rawTournamentId) &&
			rawTournamentId > 0
				? rawTournamentId
				: null,
		setupStatus:
			typeof rawSetupStatus === 'string' && SETUP_STATUSES.has(rawSetupStatus)
				? (rawSetupStatus as TournamentCreationProxyReport['setupStatus'])
				: null
	}
}

export function createTournamentCreationProxyReporter(
	startedAtMs = performance.now(),
	emit: (report: TournamentCreationProxyReport) => void = report =>
		console.info(JSON.stringify(report))
) {
	let emitted = false
	return (
		outcome: TournamentCreationProxyOutcome,
		responseStatus: number,
		result?: unknown
	): void => {
		if (emitted) return
		emitted = true
		const creation = extractTournamentCreationResult(result)
		emit({
			event: 'tournament_creation_proxy',
			outcome,
			durationMs: Math.max(0, Math.round(performance.now() - startedAtMs)),
			responseStatus,
			...creation,
			failureCode:
				outcome === 'success'
					? null
					: publicTournamentErrorCode(result, responseStatus)
		})
	}
}
