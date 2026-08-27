import 'server-only'

import { getCoreEventContext } from '@/lib/events'
import { loadGameweekDesk } from '@/lib/gameweek-desk-server'
import { loadPriceChangeBoard } from '@/lib/price-change-server'

export type DataGovernanceProbeRequest = {
	contractKey: string
	scopeKey: string
	periodKey: string
	eventId?: number | null
	sourceDay?: string | null
	producerRevision?: string | null
	expectedCount?: number | null
	observedCount?: number | null
}

export type DataGovernanceProbeResponse = {
	success: true
	contractKey: string
	scopeKey: string
	graphqlSeenAt: string
	webSeenAt: string
	graphqlRevision: string
	webRevision: string
	expectedCount: number | null
	observedCount: number | null
	complete: boolean
}

export class DataGovernanceProbeError extends Error {
	readonly code:
		'INVALID_REQUEST' | 'UNSUPPORTED_CONTRACT' | 'BUSINESS_DATA_UNAVAILABLE'

	constructor(code: DataGovernanceProbeError['code'], message: string) {
		super(message)
		this.name = 'DataGovernanceProbeError'
		this.code = code
	}
}

const positiveInteger = (value: unknown): value is number =>
	typeof value === 'number' && Number.isSafeInteger(value) && value > 0

const nonNegativeIntegerOrNull = (value: unknown): number | null =>
	value === null ||
	value === undefined ||
	(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
		? (value ?? null)
		: NaN

const requiredString = (value: unknown, field: string): string => {
	if (typeof value !== 'string' || value.trim() === '' || value.length > 256) {
		throw new DataGovernanceProbeError('INVALID_REQUEST', `${field} is invalid`)
	}
	return value
}

export function parseDataGovernanceProbeRequest(
	value: unknown
): DataGovernanceProbeRequest {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new DataGovernanceProbeError(
			'INVALID_REQUEST',
			'probe body must be an object'
		)
	}
	const body = value as Record<string, unknown>
	const contractKey = requiredString(body.contractKey, 'contractKey')
	const scopeKey = requiredString(body.scopeKey, 'scopeKey')
	const periodKey = requiredString(body.periodKey, 'periodKey')
	const eventId =
		body.eventId === null || body.eventId === undefined ? null : body.eventId
	if (eventId !== null && !positiveInteger(eventId)) {
		throw new DataGovernanceProbeError('INVALID_REQUEST', 'eventId is invalid')
	}
	const expectedCount = nonNegativeIntegerOrNull(body.expectedCount)
	const observedCount = nonNegativeIntegerOrNull(body.observedCount)
	if (Number.isNaN(expectedCount) || Number.isNaN(observedCount)) {
		throw new DataGovernanceProbeError('INVALID_REQUEST', 'counts are invalid')
	}
	const sourceDay =
		body.sourceDay === null || body.sourceDay === undefined
			? null
			: requiredString(body.sourceDay, 'sourceDay')
	const producerRevision =
		body.producerRevision === null || body.producerRevision === undefined
			? null
			: requiredString(body.producerRevision, 'producerRevision')
	return {
		contractKey,
		scopeKey,
		periodKey,
		eventId,
		sourceDay,
		producerRevision,
		expectedCount,
		observedCount
	}
}

const revision = (value: unknown): string => {
	if (typeof value !== 'string' && typeof value !== 'number') {
		throw new DataGovernanceProbeError(
			'BUSINESS_DATA_UNAVAILABLE',
			'consumer response has no revision'
		)
	}
	const result = String(value).trim()
	if (!result) {
		throw new DataGovernanceProbeError(
			'BUSINESS_DATA_UNAVAILABLE',
			'consumer response has an empty revision'
		)
	}
	return result
}

/**
 * Execute the public server loaders used by the real Web surfaces.  The
 * response is aggregate-only; entry/tournament-specific contracts are left
 * fail-closed until a server-side canary loader is configured for them.
 */
export async function probeDataContract(
	input: DataGovernanceProbeRequest
): Promise<DataGovernanceProbeResponse> {
	let graphqlRevision: string
	let expectedCount: number | null = input.expectedCount ?? null
	let observedCount: number | null = input.observedCount ?? null
	let complete = false

	try {
		switch (input.contractKey) {
			case 'core-fixtures': {
				const context = await getCoreEventContext()
				graphqlRevision = revision(context.revision)
				complete =
					context.season === input.scopeKey.split(':')[0] &&
					context.sourceCheckedAt.length > 0
				break
			}
			case 'market-price': {
				const board = await loadPriceChangeBoard()
				const market = board.priceChangeBoard
				graphqlRevision = revision(market.revision)
				expectedCount = market.expectedPlayerCount
				observedCount = market.observedPlayerCount
				complete =
					market.status === 'READY' &&
					expectedCount === observedCount
				break
			}
			case 'live-snapshot': {
				if (!positiveInteger(input.eventId)) {
					throw new DataGovernanceProbeError(
						'INVALID_REQUEST',
						'live-snapshot probe requires eventId'
					)
				}
				const desk = await loadGameweekDesk(input.eventId)
				if (desk.liveRevision === null) {
					throw new DataGovernanceProbeError(
						'BUSINESS_DATA_UNAVAILABLE',
						'live snapshot has no canonical live revision'
					)
				}
				const expectedSeason = input.scopeKey.match(/^(\d{4})(?::|$)/)?.[1]
				if (!expectedSeason || desk.season !== expectedSeason) {
					throw new DataGovernanceProbeError(
						'BUSINESS_DATA_UNAVAILABLE',
						'live snapshot season does not match the requested scope'
					)
				}
				graphqlRevision = revision(desk.liveRevision)
				complete =
					desk.eventId === input.eventId &&
					desk.overviewState === 'AVAILABLE' &&
					desk.boardsState === 'AVAILABLE'
				break
			}
			default:
				throw new DataGovernanceProbeError(
					'UNSUPPORTED_CONTRACT',
					`no server-side canary loader is configured for ${input.contractKey}`
				)
		}
	} catch (error) {
		if (error instanceof DataGovernanceProbeError) throw error
		throw new DataGovernanceProbeError(
			'BUSINESS_DATA_UNAVAILABLE',
			'consumer business loader failed'
		)
	}

	const graphqlSeenAt = new Date().toISOString()
	const webSeenAt = new Date().toISOString()
	// Do not claim a consumer revision is authoritative when the request's
	// producer target is already known to disagree. Data will also enforce this
	// parity check when it writes the observation.
	const webRevision = graphqlRevision!
	return {
		success: true,
		contractKey: input.contractKey,
		scopeKey: input.scopeKey,
		graphqlSeenAt,
		webSeenAt,
		graphqlRevision: graphqlRevision!,
		webRevision,
		expectedCount,
		observedCount,
		complete
	}
}
