import {
	GET_LIVE_MATCHDAY,
	GET_LIVE_MATCHDAY_HEAD,
	type LiveMatchdayDelivery,
	type LiveMatchdayFixture,
	type LiveMatchdayHeadSnapshot,
	type LiveMatchdayHeadResponse,
	type LiveMatchdayPlayer,
	type LiveMatchdayResponse,
	type LiveMatchdaySnapshot
} from '@/lib/graphql/operations/live'
import { executeQuery } from '@/lib/graphql-client'
import type { Match, PlayerStat } from '@/types/match'

export type QueryExecutorOptions = {
	cache?: RequestCache
	signal?: AbortSignal
	timeoutMs?: number
	handledErrorCodes?: readonly string[]
	suppressErrorLog?: boolean
}

export type QueryExecutor = <T>(
	query: string,
	variables?: Record<string, unknown>,
	options?: QueryExecutorOptions
) => Promise<T>

export type LiveMatchdayV3Payload = LiveMatchdayResponse
export type LiveMatchdayHeadV3Payload = LiveMatchdayHeadResponse

/**
 * Client-owned metadata for one complete Match V3 publication. Keep the
 * producer's revision vector, timestamps, and delivery states intact: Match
 * publications are not Live Points snapshots and must never fabricate picks,
 * rules, algorithm, or checkpoint provenance.
 */
export type LiveMatchdayStatus = Omit<LiveMatchdaySnapshot, 'matches'> & {
	availability: LiveMatchdayResponse['liveMatchday']['availability']
	delivery: LiveMatchdayDelivery
}

const statValue = (
	player: LiveMatchdayPlayer,
	identifiers: readonly string[]
): number => {
	const normalized = new Set(
		identifiers.map(identifier => identifier.toLowerCase())
	)
	const stat = player.stats.find(item =>
		normalized.has(item.identifier.toLowerCase())
	)
	return stat?.value ?? 0
}

const positionElementType: Record<LiveMatchdayPlayer['position'], number> = {
	GOALKEEPER: 1,
	DEFENDER: 2,
	MIDFIELDER: 3,
	FORWARD: 4
}

const mapLiveMatchdayPlayer = (player: LiveMatchdayPlayer): PlayerStat => ({
	player: player.webName,
	element: player.id,
	elementType: positionElementType[player.position],
	minutes: statValue(player, ['minutes', 'mins']),
	goals: statValue(player, ['goals', 'goals_scored', 'goalsScored']),
	assists: statValue(player, ['assists']),
	cleanSheets: statValue(player, ['clean_sheets', 'cleanSheets']),
	goalsConceded: statValue(player, ['goals_conceded', 'goalsConceded']),
	ownGoals: statValue(player, ['own_goals', 'ownGoals']),
	penalties_saved: statValue(player, ['penalties_saved', 'penaltiesSaved']),
	penalties_missed: statValue(player, ['penalties_missed', 'penaltiesMissed']),
	yellow_cards: statValue(player, ['yellow_cards', 'yellowCards']),
	red_cards: statValue(player, ['red_cards', 'redCards']),
	saves: statValue(player, ['saves']),
	bonus_points: statValue(player, ['bonus']),
	bps: statValue(player, ['bps']),
	defensiveContribution: statValue(player, [
		'defensive_contribution',
		'defensiveContribution'
	]),
	price: player.price,
	totalPoints: player.totalPoints
})

const matchdaySnapshotToStatus = (
	snapshot: Omit<LiveMatchdaySnapshot, 'matches'> | LiveMatchdayHeadSnapshot,
	result: Pick<
		LiveMatchdayResponse['liveMatchday'],
		'availability' | 'delivery'
	>
): LiveMatchdayStatus => {
	return {
		season: snapshot.season,
		eventId: snapshot.eventId,
		state: snapshot.state,
		revisions: {
			...snapshot.revisions,
			detailPublicationId: snapshot.revisions.detailPublicationId ?? null,
			detailGeneration: snapshot.revisions.detailGeneration ?? null,
			playerDetail: snapshot.revisions.playerDetail ?? null
		},
		times: snapshot.times,
		detailDelivery: snapshot.detailDelivery,
		availability: result.availability,
		delivery: result.delivery
	}
}

const MATCH_LIFECYCLE_STATES = new Set([
	'PRE_DEADLINE',
	'LIVE_ACTIVE',
	'BETWEEN_FIXTURES',
	'DAY_SETTLING',
	'GW_REVIEW',
	'FINALIZED'
])

const MATCH_DELIVERY_STATES = new Set([
	'FRESH',
	'STALE',
	'DEGRADED',
	'FINAL',
	'PENDING',
	'UNAVAILABLE'
])

const MATCH_SERVED_FROM = new Set([
	'REDIS_CURRENT',
	'REDIS_PREVIOUS',
	'PROCESS_LKG',
	'POSTGRES_CHECKPOINT'
])

const isTimestamp = (value: unknown): value is string =>
	typeof value === 'string' && Number.isFinite(Date.parse(value))

const utf8ByteLength = (value: string): number =>
	new TextEncoder().encode(value).byteLength

const isOptionalTimestamp = (value: unknown): boolean =>
	value === null || isTimestamp(value)

export const LIVE_MATCH_PRICE_MIN = 35
export const LIVE_MATCH_PRICE_MAX = 200

function compareLiveMatchSeasons(left: string, right: string): number {
	const leftNumber = Number(left)
	const rightNumber = Number(right)
	if (Number.isSafeInteger(leftNumber) && Number.isSafeInteger(rightNumber)) {
		return leftNumber - rightNumber
	}
	return left.localeCompare(right)
}

const isMatchDelivery = (value: unknown): value is LiveMatchdayDelivery => {
	if (!value || typeof value !== 'object') return false
	const delivery = value as LiveMatchdayDelivery
	return (
		MATCH_DELIVERY_STATES.has(delivery.state) &&
		(delivery.servedFrom === null ||
			MATCH_SERVED_FROM.has(delivery.servedFrom)) &&
		Array.isArray(delivery.reasonCodes) &&
		delivery.reasonCodes.every(
			reason => typeof reason === 'string' && reason.length > 0
		)
	)
}

const mapLiveMatchdayFixture = (fixture: LiveMatchdayFixture): Match => {
	const players = fixture.players.map(player => ({
		mapped: mapLiveMatchdayPlayer(player),
		team:
			player.teamId === fixture.homeTeamId
				? fixture.homeTeamShortName
				: fixture.awayTeamShortName,
		teamId: player.teamId
	}))
	const homePlayers = players
		.filter(player => player.teamId === fixture.homeTeamId)
		.map(player => player.mapped)
	const awayPlayers = players
		.filter(player => player.teamId === fixture.awayTeamId)
		.map(player => player.mapped)
	return {
		id: String(fixture.fixtureId),
		eventId: fixture.eventId,
		homeTeam: {
			id: fixture.homeTeamId,
			name: fixture.homeTeamName,
			shortName: fixture.homeTeamShortName,
			score: fixture.homeScore ?? 0,
			possession: 0,
			shots: 0,
			shotsOnTarget: 0,
			corners: 0,
			players: homePlayers
		},
		awayTeam: {
			id: fixture.awayTeamId,
			name: fixture.awayTeamName,
			shortName: fixture.awayTeamShortName,
			score: fixture.awayScore ?? 0,
			possession: 0,
			shots: 0,
			shotsOnTarget: 0,
			corners: 0,
			players: awayPlayers
		},
		status:
			fixture.finished || fixture.finishedProvisional
				? 'FT'
				: fixture.started
					? 'LIVE'
					: 'NOT_STARTED',
		minute: fixture.minutes,
		kickoff: fixture.kickoffTime ?? '',
		viewers: 0,
		provisional: fixture.finishedProvisional,
		bonusPoints: players
			.filter(player => (player.mapped.bonus_points ?? 0) > 0)
			.map(player => ({
				player: player.mapped.player,
				team: player.team,
				points: player.mapped.bonus_points ?? 0
			})),
		bps: players
			.filter(player => player.mapped.bps != null)
			.map(player => ({
				player: player.mapped.player,
				team: player.team,
				score: player.mapped.bps ?? 0
			}))
			.sort((left, right) => right.score - left.score)
			.slice(0, 5)
	}
}

export function transformLiveMatchdayV3(
	snapshot: LiveMatchdaySnapshot
): Match[] {
	return snapshot.matches.map(mapLiveMatchdayFixture)
}

/**
 * Keep player detail rows and derived BPS/bonus data visible when a newer
 * score desk is published before its detail publication is usable. The
 * candidate's fixture score and lifecycle fields remain authoritative. The
 * accepted same-event board is consulted only when the caller has fenced the
 * candidate as missing or older detail; otherwise even an empty candidate
 * collection is authoritative and must not resurrect stale rows.
 */
export function retainLiveMatchPlayerDetails(
	candidate: readonly Match[],
	accepted: readonly Match[],
	options: { detailFallback?: 'accepted' | 'candidate' } = {}
): Match[] {
	// The candidate is authoritative by default. The caller may select the
	// accepted board only after the revision fence proves that candidate detail
	// is absent or older; a present newer publication, including an empty one,
	// must never resurrect rows from the accepted board.
	const detailFallback = options.detailFallback ?? 'candidate'
	const useAcceptedDetails = detailFallback === 'accepted'
	const acceptedByFixtureId = new Map(accepted.map(match => [match.id, match]))

	return candidate.map(match => {
		const previous = acceptedByFixtureId.get(match.id)
		if (!previous) return match

		const homePlayers = useAcceptedDetails
			? previous.homeTeam.players
			: match.homeTeam.players
		const awayPlayers = useAcceptedDetails
			? previous.awayTeam.players
			: match.awayTeam.players
		const homeTeam =
			homePlayers === match.homeTeam.players
				? match.homeTeam
				: { ...match.homeTeam, players: homePlayers }
		const awayTeam =
			awayPlayers === match.awayTeam.players
				? match.awayTeam
				: { ...match.awayTeam, players: awayPlayers }
		const bonusPoints = useAcceptedDetails
			? previous.bonusPoints
			: match.bonusPoints
		const bps = useAcceptedDetails ? previous.bps : match.bps

		if (
			homeTeam === match.homeTeam &&
			awayTeam === match.awayTeam &&
			bonusPoints === match.bonusPoints &&
			bps === match.bps
		) {
			return match
		}

		return {
			...match,
			homeTeam,
			awayTeam,
			...(bonusPoints !== match.bonusPoints ? { bonusPoints } : {}),
			...(bps !== match.bps ? { bps } : {})
		}
	})
}

/**
 * A newer score desk may be published without a usable detail publication.
 * Keep the accepted detail revision as the ordering fence so an older detail
 * fallback cannot replace the rows that are still being displayed.
 */
export function shouldRetainAcceptedLiveMatchDetails(
	candidate: Pick<LiveMatchdayStatus, 'revisions'>,
	accepted: Pick<LiveMatchdayStatus, 'revisions'>
): boolean {
	const acceptedRevision = accepted.revisions
	const candidateRevision = candidate.revisions
	if (
		acceptedRevision.detailPublicationId === null ||
		acceptedRevision.detailGeneration === null ||
		acceptedRevision.playerDetail === null
	) {
		return false
	}
	if (candidateRevision.detailGeneration === null) return true
	if (candidateRevision.detailGeneration < acceptedRevision.detailGeneration) {
		return true
	}
	return (
		candidateRevision.detailGeneration === acceptedRevision.detailGeneration &&
		candidateRevision.detailPublicationId !==
			acceptedRevision.detailPublicationId
	)
}

/** Carry the exact detail provenance for rows retained from the accepted LKG. */
export function retainLiveMatchdayDetailRevision(
	candidate: LiveMatchdayStatus,
	accepted: LiveMatchdayStatus
): LiveMatchdayStatus {
	if (!shouldRetainAcceptedLiveMatchDetails(candidate, accepted)) {
		return candidate
	}

	return {
		...candidate,
		revisions: {
			...candidate.revisions,
			detailObservation: accepted.revisions.detailObservation,
			detailPublicationId: accepted.revisions.detailPublicationId,
			detailGeneration: accepted.revisions.detailGeneration,
			playerDetail: accepted.revisions.playerDetail
		},
		times: {
			...candidate.times,
			detailSourceCheckedAt: accepted.times.detailSourceCheckedAt,
			detailContentUpdatedAt: accepted.times.detailContentUpdatedAt,
			detailPublishedAt: accepted.times.detailPublishedAt,
			detailStaleAt: accepted.times.detailStaleAt
		},
		detailDelivery: {
			...accepted.detailDelivery,
			state: 'STALE',
			reasonCodes: Array.from(
				new Set([
					...accepted.detailDelivery.reasonCodes,
					'DETAIL_REVISION_RETAINED'
				])
			)
		}
	}
}

export function validateLiveMatchdayV3(
	payload: LiveMatchdayV3Payload
): LiveMatchdayV3Payload {
	if (!payload || typeof payload !== 'object' || !payload.liveMatchday) {
		throw new Error('LIVE_MATCHDAY_INCOHERENT')
	}
	const result = payload.liveMatchday
	if (
		(result.availability !== 'READY' &&
			result.availability !== 'UNAVAILABLE') ||
		!isMatchDelivery(result.delivery)
	) {
		throw new Error('LIVE_MATCHDAY_INCOHERENT')
	}
	const snapshot = result.snapshot
	if (result.availability === 'UNAVAILABLE') {
		if (
			snapshot !== null ||
			result.delivery.state !== 'UNAVAILABLE' ||
			result.delivery.servedFrom !== null
		) {
			throw new Error('LIVE_MATCHDAY_INCOHERENT')
		}
		return payload
	}
	if (
		!snapshot ||
		result.delivery.state === 'UNAVAILABLE' ||
		result.delivery.state === 'PENDING' ||
		result.delivery.servedFrom === null
	) {
		throw new Error('LIVE_MATCHDAY_INCOHERENT')
	}
	if (!snapshot.revisions || !snapshot.times) {
		throw new Error('LIVE_MATCHDAY_INCOHERENT')
	}
	const detailRevisionPresent =
		typeof snapshot.revisions.detailPublicationId === 'string' &&
		snapshot.revisions.detailPublicationId.length > 0 &&
		Number.isSafeInteger(snapshot.revisions.detailGeneration) &&
		Number(snapshot.revisions.detailGeneration) > 0 &&
		typeof snapshot.revisions.playerDetail === 'string' &&
		snapshot.revisions.playerDetail.length > 0
	const detailRevisionAbsent =
		snapshot.revisions.detailPublicationId === null &&
		snapshot.revisions.detailGeneration === null &&
		snapshot.revisions.playerDetail === null
	const detailObservationPresent =
		typeof snapshot.revisions.detailObservation === 'string' &&
		snapshot.revisions.detailObservation.length > 0
	const detailObservationAbsent = snapshot.revisions.detailObservation === null
	const detailTimesPresent =
		isTimestamp(snapshot.times.detailSourceCheckedAt) &&
		isTimestamp(snapshot.times.detailContentUpdatedAt) &&
		isTimestamp(snapshot.times.detailPublishedAt) &&
		isOptionalTimestamp(snapshot.times.detailStaleAt)
	const detailTimesAbsent =
		snapshot.times.detailSourceCheckedAt === null &&
		snapshot.times.detailContentUpdatedAt === null &&
		snapshot.times.detailPublishedAt === null &&
		snapshot.times.detailStaleAt === null
	if (
		!snapshot.season ||
		!Number.isSafeInteger(snapshot.eventId) ||
		snapshot.eventId <= 0 ||
		!MATCH_LIFECYCLE_STATES.has(snapshot.state) ||
		!snapshot.revisions.deskPublicationId ||
		!Number.isSafeInteger(snapshot.revisions.deskGeneration) ||
		snapshot.revisions.deskGeneration <= 0 ||
		!snapshot.revisions.lifecycle ||
		!snapshot.revisions.fixtureIdentity ||
		!snapshot.revisions.scoreState ||
		(!detailRevisionPresent && !detailRevisionAbsent) ||
		(!detailObservationPresent && !detailObservationAbsent) ||
		(detailRevisionPresent && !detailObservationPresent) ||
		!isTimestamp(snapshot.times.deskSourceCheckedAt) ||
		!isTimestamp(snapshot.times.deskContentUpdatedAt) ||
		!isTimestamp(snapshot.times.deskPublishedAt) ||
		!isOptionalTimestamp(snapshot.times.deskStaleAt) ||
		!isOptionalTimestamp(snapshot.times.detailSourceCheckedAt) ||
		!isOptionalTimestamp(snapshot.times.detailContentUpdatedAt) ||
		!isOptionalTimestamp(snapshot.times.detailPublishedAt) ||
		!isOptionalTimestamp(snapshot.times.detailStaleAt) ||
		!isTimestamp(snapshot.times.servedAt) ||
		!isOptionalTimestamp(snapshot.times.nextRefreshAt) ||
		!isMatchDelivery(snapshot.detailDelivery) ||
		!Array.isArray(snapshot.matches)
	) {
		throw new Error('LIVE_MATCHDAY_INCOHERENT')
	}
	if (
		detailTimesPresent !== detailObservationPresent ||
		detailTimesAbsent !== !detailObservationPresent ||
		(detailRevisionAbsent &&
			detailObservationAbsent &&
			(snapshot.detailDelivery.servedFrom !== null ||
				!['PENDING', 'DEGRADED'].includes(snapshot.detailDelivery.state))) ||
		(detailRevisionAbsent &&
			detailObservationPresent &&
			(snapshot.detailDelivery.servedFrom === null ||
				!['PENDING', 'DEGRADED'].includes(snapshot.detailDelivery.state))) ||
		(detailRevisionPresent &&
			(snapshot.detailDelivery.servedFrom === null ||
				['PENDING', 'UNAVAILABLE'].includes(snapshot.detailDelivery.state))) ||
		(result.delivery.state === 'FINAL' &&
			(snapshot.state !== 'FINALIZED' ||
				snapshot.detailDelivery.state !== 'FINAL' ||
				!detailRevisionPresent))
	) {
		throw new Error('LIVE_MATCHDAY_INCOHERENT')
	}
	const fixtureIds = new Set<number>()
	for (const fixture of snapshot.matches) {
		if (
			fixture.eventId !== snapshot.eventId ||
			!Number.isSafeInteger(fixture.fixtureId) ||
			fixture.fixtureId <= 0 ||
			fixtureIds.has(fixture.fixtureId) ||
			!Number.isSafeInteger(fixture.homeTeamId) ||
			!Number.isSafeInteger(fixture.awayTeamId) ||
			fixture.homeTeamId <= 0 ||
			fixture.awayTeamId <= 0 ||
			fixture.homeTeamId === fixture.awayTeamId ||
			!fixture.homeTeamName ||
			!fixture.homeTeamShortName ||
			!fixture.awayTeamName ||
			!fixture.awayTeamShortName ||
			(fixture.homeScore !== null &&
				(!Number.isSafeInteger(fixture.homeScore) || fixture.homeScore < 0)) ||
			(fixture.awayScore !== null &&
				(!Number.isSafeInteger(fixture.awayScore) || fixture.awayScore < 0)) ||
			(fixture.kickoffTime !== null && !isTimestamp(fixture.kickoffTime)) ||
			!Number.isSafeInteger(fixture.minutes) ||
			fixture.minutes < 0 ||
			typeof fixture.started !== 'boolean' ||
			typeof fixture.finished !== 'boolean' ||
			typeof fixture.finishedProvisional !== 'boolean' ||
			!Array.isArray(fixture.players)
		) {
			throw new Error('LIVE_MATCHDAY_INCOHERENT')
		}
		fixtureIds.add(fixture.fixtureId)
		const playerIds = new Set<number>()
		for (const player of fixture.players) {
			if (
				!Number.isSafeInteger(player.id) ||
				player.id <= 0 ||
				playerIds.has(player.id) ||
				(player.teamId !== fixture.homeTeamId &&
					player.teamId !== fixture.awayTeamId) ||
				!player.webName ||
				!Object.prototype.hasOwnProperty.call(
					positionElementType,
					player.position
				) ||
				!Number.isSafeInteger(player.price) ||
				player.price < LIVE_MATCH_PRICE_MIN ||
				player.price > LIVE_MATCH_PRICE_MAX ||
				!Number.isSafeInteger(player.totalPoints) ||
				!Array.isArray(player.stats)
			) {
				throw new Error('LIVE_MATCHDAY_INCOHERENT')
			}
			playerIds.add(player.id)
			const statIdentifiers = new Set<string>()
			for (const stat of player.stats) {
				const identifier =
					typeof stat.identifier === 'string'
						? stat.identifier.trim().toLowerCase()
						: ''
				if (
					!identifier ||
					statIdentifiers.has(identifier) ||
					!Number.isFinite(stat.value) ||
					(stat.awardedPoints !== undefined &&
						!Number.isFinite(stat.awardedPoints))
				) {
					throw new Error('LIVE_MATCHDAY_INCOHERENT')
				}
				statIdentifiers.add(identifier)
			}
		}
	}
	return payload
}

export async function loadLiveMatchdayV3(
	executor: QueryExecutor,
	eventId?: number | null,
	options: Pick<QueryExecutorOptions, 'signal'> = {}
): Promise<LiveMatchdayV3Payload> {
	const payload = await executor<LiveMatchdayV3Payload>(
		GET_LIVE_MATCHDAY,
		{ eventId: eventId ?? null },
		{ cache: 'no-store', timeoutMs: 5_000, ...options }
	)
	return validateLiveMatchdayV3(payload)
}

export function validateLiveMatchdayHeadV3(
	payload: LiveMatchdayHeadV3Payload
): LiveMatchdayHeadV3Payload {
	if (!payload || typeof payload !== 'object' || !payload.liveMatchday) {
		throw new Error('LIVE_MATCHDAY_INCOHERENT')
	}
	const result = payload.liveMatchday
	if (
		result.availability !== 'READY' &&
		result.availability !== 'UNAVAILABLE'
	) {
		throw new Error('LIVE_MATCHDAY_INCOHERENT')
	}
	if (!isMatchDelivery(result.delivery))
		throw new Error('LIVE_MATCHDAY_INCOHERENT')
	if (result.availability === 'UNAVAILABLE') {
		if (
			result.snapshot !== null ||
			result.delivery.state !== 'UNAVAILABLE' ||
			result.delivery.servedFrom !== null
		) {
			throw new Error('LIVE_MATCHDAY_INCOHERENT')
		}
		return payload
	}
	if (!result.snapshot) throw new Error('LIVE_MATCHDAY_INCOHERENT')
	// The metadata-only response intentionally has no `matches` field. Reuse
	// the complete validator for all publication, revision, timestamp and
	// delivery invariants with an empty synthetic match list, then return the
	// original head payload unchanged.
	const completeShape = {
		liveMatchday: {
			...result,
			snapshot: {
				...result.snapshot,
				revisions: {
					...result.snapshot.revisions,
					detailPublicationId: null,
					detailGeneration: null,
					playerDetail: null
				},
				matches: []
			}
		}
	} as unknown as LiveMatchdayV3Payload
	validateLiveMatchdayV3(completeShape)
	return payload
}

export async function loadLiveMatchdayHeadV3(
	executor: QueryExecutor,
	eventId?: number | null,
	options: Pick<QueryExecutorOptions, 'signal'> = {}
): Promise<LiveMatchdayHeadV3Payload> {
	const payload = await executor<LiveMatchdayHeadV3Payload>(
		GET_LIVE_MATCHDAY_HEAD,
		{ eventId: eventId ?? null },
		{ cache: 'no-store', timeoutMs: 5_000, ...options }
	)
	return validateLiveMatchdayHeadV3(payload)
}

export function getPreferredLiveMatchesTab(
	matches: readonly Match[]
): 'live' | 'finished' | 'not-started' {
	const hasLive = matches.some(
		match => match.status === 'LIVE' || match.status === 'HT'
	)
	const hasFinished = matches.some(match => match.status === 'FT')
	const hasNotStarted = matches.some(match => match.status === 'NOT_STARTED')
	const hasUpcoming = matches.some(match => match.status === 'UPCOMING')

	if (hasLive) return 'live'
	if (hasNotStarted) return 'not-started'
	if (hasFinished) return 'finished'
	if (hasUpcoming) return 'not-started'
	return 'live'
}

export interface LiveMatchesSnapshot {
	matches: Match[]
	snapshot: LiveMatchdayStatus | null
	currentEventId: number | null
	availability: LiveMatchdayResponse['liveMatchday']['availability']
	delivery: LiveMatchdayDelivery
	/** Decoded JSON bytes observed before mapping into the UI model. */
	decodedBytes?: number
}

export interface LiveMatchesLoadOptions {
	/** Browser FULL refreshes use the V3 publication GET route. */
	preferHttp?: boolean
	signal?: AbortSignal
}

/**
 * Only a complete same-event V3 publication may replace a browser LKG.
 * UNAVAILABLE is a delivery observation, not an empty successful matchday.
 */
export function canReplaceLiveMatchesLkg(
	value: Pick<LiveMatchesSnapshot, 'snapshot' | 'availability'>,
	accepted?: LiveMatchdayStatus | null
): boolean {
	if (value.snapshot === null || value.availability !== 'READY') return false
	if (!accepted) return true
	if (
		value.snapshot.season !== accepted.season ||
		value.snapshot.eventId !== accepted.eventId
	) {
		// Generations are scoped to season/event. A lifecycle transition may
		// replace the previous event, but both season and same-season event IDs
		// must move forward so an eventless fallback cannot repaint an older
		// season after the new season has already been accepted.
		const seasonOrder = compareLiveMatchSeasons(
			value.snapshot.season,
			accepted.season
		)
		if (seasonOrder < 0) return false
		if (seasonOrder === 0 && value.snapshot.eventId < accepted.eventId) {
			return false
		}
		return true
	}

	const candidate = value.snapshot.revisions
	const current = accepted.revisions
	if (candidate.deskGeneration < current.deskGeneration) return false
	if (candidate.deskGeneration > current.deskGeneration) return true
	if (candidate.deskPublicationId !== current.deskPublicationId) return false

	// HEAD/DESK deliberately omit authoritative detail fields. A matching
	// descriptor observation can advance heartbeat metadata while the accepted
	// FULL detail remains the browser LKG. An absent observation is unknown, not
	// permission to erase the accepted detail.
	const candidateHasFullDetail =
		candidate.detailPublicationId !== null &&
		candidate.detailGeneration !== null &&
		candidate.playerDetail !== null
	const currentHasFullDetail =
		current.detailPublicationId !== null &&
		current.detailGeneration !== null &&
		current.playerDetail !== null
	if (!candidateHasFullDetail) {
		if (!currentHasFullDetail) return true
		return (
			candidate.detailObservation === null ||
			candidate.detailObservation === current.detailObservation
		)
	}

	if (current.detailGeneration === null) return true
	if (candidate.detailGeneration === null) return false
	if (candidate.detailGeneration < current.detailGeneration) return false
	if (candidate.detailGeneration > current.detailGeneration) return true
	if (candidate.detailPublicationId !== current.detailPublicationId)
		return false
	return true
}

const validEventId = (value: unknown): number | null =>
	typeof value === 'number' && Number.isInteger(value) && value > 0
		? value
		: null

const LIVE_MATCHES_CONTRACT_HEADER = 'X-LetLetMe-Contract'
const LIVE_MATCHES_CONTRACT_VERSION = 'live-matches-v3'

export type LiveMatchesRequestParams =
	| { ok: true; eventId: number | undefined }
	| {
			ok: false
			status: 400 | 426
			error: 'Invalid live matchday request' | 'CLIENT_UPGRADE_REQUIRED'
	  }

export function parseLiveMatchesRequestParams(
	params: URLSearchParams
): LiveMatchesRequestParams {
	const legacyParameters = [
		'season',
		'revision',
		'scoreCoreRevision',
		'includePlayers'
	]
	if (legacyParameters.some(parameter => params.has(parameter))) {
		return { ok: false, status: 426, error: 'CLIENT_UPGRADE_REQUIRED' }
	}
	let hasUnknownParameter = false
	params.forEach((_value, parameter) => {
		if (parameter !== 'eventId') hasUnknownParameter = true
	})
	if (hasUnknownParameter) {
		return { ok: false, status: 400, error: 'Invalid live matchday request' }
	}
	const values = params.getAll('eventId')
	if (values.length === 0) return { ok: true, eventId: undefined }
	const eventId = Number(values[0])
	if (values.length > 1 || !Number.isSafeInteger(eventId) || eventId <= 0) {
		return { ok: false, status: 400, error: 'Invalid live matchday request' }
	}
	return { ok: true, eventId }
}

export async function getLiveMatchesSnapshot(
	executor: QueryExecutor = executeQuery,
	currentEventId: number | null = null,
	options: LiveMatchesLoadOptions = {}
): Promise<LiveMatchesSnapshot> {
	let payload: LiveMatchdayV3Payload
	let decodedBytes: number
	if (options.preferHttp) {
		const params = new URLSearchParams()
		if (currentEventId) params.set('eventId', String(currentEventId))
		const query = params.size > 0 ? `?${params.toString()}` : ''
		const response = await fetch(`/api/live/matches${query}`, {
			cache: 'no-store',
			headers: {
				[LIVE_MATCHES_CONTRACT_HEADER]: LIVE_MATCHES_CONTRACT_VERSION
			},
			signal: options.signal
		})
		if (!response.ok) {
			throw new Error(`Live matches request failed (${response.status})`)
		}
		const body = await response.text()
		decodedBytes = utf8ByteLength(body)
		payload = validateLiveMatchdayV3(JSON.parse(body) as LiveMatchdayV3Payload)
	} else {
		payload = await loadLiveMatchdayV3(executor, currentEventId, options)
		decodedBytes = utf8ByteLength(JSON.stringify(payload))
	}

	const result = payload.liveMatchday
	const matchday = result.snapshot
	if (currentEventId && matchday && matchday.eventId !== currentEventId) {
		throw new Error('LIVE_MATCHDAY_EVENT_MISMATCH')
	}
	const current = validEventId(matchday?.eventId) ?? currentEventId
	const snapshot = matchday ? matchdaySnapshotToStatus(matchday, result) : null

	return {
		matches: matchday ? transformLiveMatchdayV3(matchday) : [],
		snapshot,
		currentEventId: current,
		availability: result.availability,
		delivery: result.delivery,
		decodedBytes
	}
}

/**
 * Cheap revision/freshness observation. HEAD never goes through the full
 * snapshot route because that route is deliberately reserved for an
 * authoritative page replacement.
 */
export async function getLiveMatchesHead(
	executor: QueryExecutor = executeQuery,
	currentEventId: number | null = null,
	options: Pick<LiveMatchesLoadOptions, 'signal'> = {}
): Promise<LiveMatchesHeadSnapshotResult> {
	const payload = await loadLiveMatchdayHeadV3(
		executor,
		currentEventId,
		options
	)
	const result = payload.liveMatchday
	const matchday = result.snapshot
	if (currentEventId && matchday && matchday.eventId !== currentEventId) {
		throw new Error('LIVE_MATCHDAY_EVENT_MISMATCH')
	}
	const current = validEventId(matchday?.eventId) ?? currentEventId
	return {
		snapshot: matchday ? matchdaySnapshotToStatus(matchday, result) : null,
		currentEventId: current,
		availability: result.availability,
		delivery: result.delivery,
		decodedBytes: utf8ByteLength(JSON.stringify(payload))
	}
}

export interface LiveMatchesHeadSnapshotResult {
	snapshot: LiveMatchdayStatus | null
	currentEventId: number | null
	availability: LiveMatchdayHeadResponse['liveMatchday']['availability']
	delivery: LiveMatchdayDelivery
	decodedBytes?: number
}
