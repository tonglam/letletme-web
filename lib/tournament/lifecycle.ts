import type {
	EntryTournament,
	TournamentSetupPhase,
	TournamentSetupProgressMode,
	TournamentSetupStatus,
	TournamentSetupWarningSummary
} from '@/lib/graphql/operations/tournaments'

export type TournamentLifecycleBadge =
	| 'settingUp'
	| 'standingsReady'
	| 'ready'
	| 'readyWithWarnings'
	| 'needsAttention'
	| 'paused'
	| 'finished'

export type TournamentSetupStatusPayload = {
	tournamentId: number
	setupStatus: TournamentSetupStatus
	setupPhase: TournamentSetupPhase
	setupCompletedUnits: number
	setupTotalUnits: number
	setupProgressUpdatedAt: string | null
	setupProgressMode: TournamentSetupProgressMode
	setupAttempt: number
	setupMaxAttempts: number
	nextRetryAt: string | null
	standingsReadyAt: string | null
	profilesReadyAt: string | null
	insightsReadyAt: string | null
	setupHasWarnings: boolean
	warningSummaries: TournamentSetupWarningSummary[]
	setupStartedAt: string | null
	setupFinishedAt: string | null
}

const setupStatusValues = new Set<TournamentSetupStatus>([
	'PENDING',
	'PROCESSING',
	'READY',
	'FAILED'
])
const setupPhaseValues = new Set<TournamentSetupPhase>([
	'QUEUED',
	'SYNCING_ENTRIES',
	'BUILDING_STRUCTURE',
	'CALCULATING_STANDINGS',
	'ENRICHING_HISTORY',
	'FINALIZING',
	'READY',
	'FAILED'
])

export const getTournamentLifecycleBadge = (
	tournament: Pick<
		EntryTournament,
		| 'state'
		| 'rosterSyncStatus'
		| 'setupStatus'
		| 'standingsReadyAt'
		| 'setupHasWarnings'
		| 'warningSummaries'
	>
): TournamentLifecycleBadge => {
	if (
		tournament.rosterSyncStatus === 'FAILED' ||
		tournament.setupStatus === 'FAILED'
	) {
		return 'needsAttention'
	}
	if (tournament.state === 'FINISHED') return 'finished'
	if (tournament.state === 'INACTIVE') return 'paused'
	if (!tournament.standingsReadyAt) return 'settingUp'
	if (tournament.setupStatus !== 'READY') return 'standingsReady'
	if (
		tournament.setupHasWarnings ||
		Boolean(tournament.warningSummaries?.length)
	) {
		return 'readyWithWarnings'
	}
	return 'ready'
}

export const areTournamentInsightsReady = (
	tournament: Pick<
		EntryTournament,
		'setupStatus' | 'insightsReadyAt' | 'standingsReadyAt'
	>
): boolean =>
	Boolean(tournament.standingsReadyAt) &&
	tournament.setupStatus === 'READY' &&
	Boolean(tournament.insightsReadyAt)

export const areTournamentStandingsReady = (
	tournament: Pick<EntryTournament, 'standingsReadyAt'>
): boolean => Boolean(tournament.standingsReadyAt)

export const shouldPollTournamentSetup = ({
	setupStatus,
	insightsReadyAt,
	visible,
	online
}: {
	setupStatus: TournamentSetupStatus
	insightsReadyAt: string | null | undefined
	visible: boolean
	online: boolean
}): boolean =>
	visible &&
	online &&
	(isTournamentSetupInFlight(setupStatus) ||
		(setupStatus === 'READY' && !insightsReadyAt))

export const isTournamentSetupInFlight = (
	status: TournamentSetupStatus
): boolean => status === 'PENDING' || status === 'PROCESSING'

export const isTournamentSetupPollingPending = (
	setupStatus: TournamentSetupStatus,
	insightsReadyAt: string | null | undefined
): boolean =>
	isTournamentSetupInFlight(setupStatus) ||
	(setupStatus === 'READY' && !insightsReadyAt)

export const isTournamentRosterSyncInFlight = (
	status: TournamentSetupStatus | null
): boolean => status === 'PENDING' || status === 'PROCESSING'

const optionalString = (value: unknown): string | null =>
	typeof value === 'string' ? value : null

export const normalizeTournamentSetupStatus = (
	value: unknown
): TournamentSetupStatusPayload | null => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null
	const payload = value as Record<string, unknown>
	const tournamentId = Number(payload.tournamentId)
	const setupStatus = String(
		payload.setupStatus ?? ''
	).toUpperCase() as TournamentSetupStatus
	const setupPhase = String(
		payload.setupPhase ?? ''
	).toUpperCase() as TournamentSetupPhase
	const setupProgressMode = String(
		payload.setupProgressMode ?? payload.progressMode ?? 'DETERMINATE'
	).toUpperCase() as TournamentSetupProgressMode
	const completed = Number(payload.setupCompletedUnits)
	const total = Number(payload.setupTotalUnits)
	if (
		!Number.isSafeInteger(tournamentId) ||
		tournamentId <= 0 ||
		!setupStatusValues.has(setupStatus) ||
		!setupPhaseValues.has(setupPhase) ||
		!['DETERMINATE', 'INDETERMINATE'].includes(setupProgressMode) ||
		!Number.isSafeInteger(completed) ||
		completed < 0 ||
		!Number.isSafeInteger(total) ||
		total < 0 ||
		(total > 0 && completed > total)
	) {
		return null
	}

	return {
		tournamentId,
		setupStatus,
		setupPhase,
		setupCompletedUnits: completed,
		setupTotalUnits: total,
		setupProgressMode,
		setupAttempt: Number.isSafeInteger(Number(payload.setupAttempt))
			? Number(payload.setupAttempt)
			: 0,
		setupMaxAttempts: Number.isSafeInteger(Number(payload.setupMaxAttempts))
			? Number(payload.setupMaxAttempts)
			: 3,
		nextRetryAt: optionalString(payload.nextRetryAt),
		setupProgressUpdatedAt: optionalString(payload.setupProgressUpdatedAt),
		standingsReadyAt: optionalString(payload.standingsReadyAt),
		profilesReadyAt: optionalString(payload.profilesReadyAt),
		insightsReadyAt: optionalString(payload.insightsReadyAt),
		setupHasWarnings: payload.setupHasWarnings === true,
		warningSummaries: Array.isArray(payload.warningSummaries)
			? payload.warningSummaries
					.filter((item): item is Record<string, unknown> => {
						if (!item || typeof item !== 'object' || Array.isArray(item))
							return false
						const candidate = item as Record<string, unknown>
						return (
							['PROFILES', 'INSIGHTS', 'RESULTS'].includes(
								String(candidate.category).toUpperCase()
							) &&
							Number.isSafeInteger(Number(candidate.affectedCount)) &&
							Number(candidate.affectedCount) >= 0
						)
					})
					.map(item => ({
						category: String(
							item.category
						).toUpperCase() as TournamentSetupWarningSummary['category'],
						affectedCount: Number(item.affectedCount)
					}))
			: [],
		setupStartedAt: optionalString(payload.setupStartedAt),
		setupFinishedAt: optionalString(payload.setupFinishedAt)
	}
}
