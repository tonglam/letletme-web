import type {
	EntryTournament,
	TournamentSetupPhase,
	TournamentSetupStatus
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
	standingsReadyAt: string | null
	setupHasWarnings: boolean
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
	>
): TournamentLifecycleBadge => {
	if (tournament.state === 'FINISHED') return 'finished'
	if (
		tournament.rosterSyncStatus === 'FAILED' ||
		(tournament.setupStatus === 'FAILED' && !tournament.standingsReadyAt)
	) {
		return 'needsAttention'
	}
	if (tournament.state === 'INACTIVE') return 'paused'
	if (!tournament.standingsReadyAt) return 'settingUp'
	if (tournament.setupStatus !== 'READY') return 'standingsReady'
	if (tournament.setupHasWarnings) return 'readyWithWarnings'
	return 'ready'
}

export const areTournamentInsightsReady = (
	tournament: Pick<
		EntryTournament,
		'setupStatus' | 'setupHasWarnings' | 'standingsReadyAt'
	>
): boolean =>
	Boolean(tournament.standingsReadyAt) &&
	tournament.setupStatus === 'READY' &&
	!tournament.setupHasWarnings

export const shouldPollTournamentSetup = ({
	setupStatus,
	visible,
	online
}: {
	setupStatus: TournamentSetupStatus
	visible: boolean
	online: boolean
}): boolean =>
	visible &&
	online &&
	(setupStatus === 'PENDING' || setupStatus === 'PROCESSING')

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
	const completed = Number(payload.setupCompletedUnits)
	const total = Number(payload.setupTotalUnits)
	if (
		!Number.isSafeInteger(tournamentId) ||
		tournamentId <= 0 ||
		!setupStatusValues.has(setupStatus) ||
		!setupPhaseValues.has(setupPhase) ||
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
		setupProgressUpdatedAt: optionalString(payload.setupProgressUpdatedAt),
		standingsReadyAt: optionalString(payload.standingsReadyAt),
		setupHasWarnings: payload.setupHasWarnings === true,
		setupStartedAt: optionalString(payload.setupStartedAt),
		setupFinishedAt: optionalString(payload.setupFinishedAt)
	}
}
