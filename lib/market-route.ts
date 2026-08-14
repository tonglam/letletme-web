import { executeQuery, GraphQLRequestError } from '@/lib/graphql-client'
import {
	buildIngressContextHeaders,
	buildOpaqueRateLimitSubject
} from '@/lib/http-security-core'
import {
	GET_MARKET_AVAILABILITY,
	GET_MARKET_PLAYERS,
	GET_MARKET_PRICE_HISTORY,
	type MarketAvailabilityResponse,
	type MarketHistoryResponse,
	type MarketPlayersResponse
} from '@/lib/graphql/operations/market'
import { NextResponse } from 'next/server'

export const MARKET_PUBLIC_CACHE_CONTROL =
	'public, s-maxage=300, stale-while-revalidate=300, no-transform'
export const MARKET_UNCACHEABLE_CONTROL = 'no-store'

function logMarketRoute(
	route: 'players' | 'history' | 'availability',
	outcome: 'success' | 'revision_changed' | 'rate_limited' | 'failure',
	startedAt: number,
	metadata: Record<string, unknown> = {}
) {
	console.info('[market-route]', {
		route,
		outcome,
		durationMs: Math.max(0, Date.now() - startedAt),
		...metadata
	})
}

type ParsedBase = { revision: number }

const one = (params: URLSearchParams, key: string): string | null => {
	const values = params.getAll(key)
	return values.length === 1
		? values[0]
		: values.length === 0
			? null
			: '__duplicate__'
}

const rejectUnknown = (
	params: URLSearchParams,
	allowed: readonly string[]
): string | null => {
	const allowedKeys = new Set(allowed)
	let unknown: string | null = null
	params.forEach((_value, key) => {
		if (!unknown && !allowedKeys.has(key)) unknown = key
	})
	return unknown ? `unknown parameter: ${unknown}` : null
}

const parseNonNegative = (value: string | null): number | null =>
	value !== null && /^(0|[1-9]\d*)$/.test(value) ? Number(value) : null

const parsePositive = (value: string | null): number | null => {
	const parsed = parseNonNegative(value)
	return parsed !== null && Number.isSafeInteger(parsed) && parsed > 0
		? parsed
		: null
}

const currentRevisionNumber = (revision: string): number => {
	const match = /(?:^|[-.])([0-9]+)$/.exec(revision)
	return match ? Number(match[1]) : 0
}

function parseBase(params: URLSearchParams): ParsedBase | { error: string } {
	const revisionValue = one(params, 'revision')
	const revision = parseNonNegative(revisionValue)
	if (
		revisionValue === null ||
		revision === null ||
		!Number.isSafeInteger(revision)
	) {
		return { error: 'revision must be a non-negative integer' }
	}
	return { revision }
}

export function parseMarketPlayersParams(
	params: URLSearchParams
): (ParsedBase & { search: string; limit: number }) | { error: string } {
	const unknown = rejectUnknown(params, ['revision', 'search', 'limit'])
	if (unknown) return { error: unknown }
	const base = parseBase(params)
	if ('error' in base) return base
	const searchValue = one(params, 'search')
	const limitValue = one(params, 'limit')
	const limit = parsePositive(limitValue)
	if (searchValue === null || searchValue === '__duplicate__')
		return { error: 'search is required and must appear once' }
	if (limit === null || limit > 20)
		return { error: 'limit must be an integer between 1 and 20' }
	const search = searchValue.normalize('NFKC').trim().replace(/\s+/g, ' ')
	if (search.length < 2 || search.length > 50)
		return { error: 'search must contain 2 to 50 characters' }
	return { ...base, search, limit }
}

export function parseMarketHistoryParams(
	params: URLSearchParams
): (ParsedBase & { playerId: number }) | { error: string } {
	const unknown = rejectUnknown(params, ['revision', 'playerId'])
	if (unknown) return { error: unknown }
	const base = parseBase(params)
	if ('error' in base) return base
	const playerValue = one(params, 'playerId')
	const playerId = parsePositive(playerValue)
	if (playerValue === null || playerId === null)
		return { error: 'playerId must be a positive integer' }
	return { ...base, playerId }
}

export function parseMarketAvailabilityParams(
	params: URLSearchParams
): (ParsedBase & { days: number }) | { error: string } {
	const unknown = rejectUnknown(params, ['revision', 'days'])
	if (unknown) return { error: unknown }
	const base = parseBase(params)
	if ('error' in base) return base
	const daysValue = one(params, 'days')
	const days = parsePositive(daysValue)
	if (days === null || days > 30)
		return { error: 'days must be an integer between 1 and 30' }
	return { ...base, days }
}

const ingressHeaders = (request: Request): Record<string, string> => {
	const secret = process.env.BACKEND_PROXY_SECRET?.trim() ?? ''
	if (!secret) return {}
	const subject = buildOpaqueRateLimitSubject(request.headers, secret)
	return buildIngressContextHeaders(subject, secret)
}

function invalid(error: string): NextResponse {
	return NextResponse.json(
		{ error },
		{ status: 400, headers: { 'Cache-Control': MARKET_UNCACHEABLE_CONTROL } }
	)
}

function upstreamFailure(error: unknown): NextResponse {
	if (error instanceof GraphQLRequestError && error.status === 429) {
		const retryAfter = Math.min(Math.max(error.retryAfterSeconds ?? 5, 1), 60)
		return NextResponse.json(
			{ error: 'rate_limited' },
			{
				status: 429,
				headers: {
					'Cache-Control': MARKET_UNCACHEABLE_CONTROL,
					'Retry-After': String(retryAfter)
				}
			}
		)
	}
	return NextResponse.json(
		{ error: 'market data is temporarily unavailable' },
		{
			status: 502,
			headers: { 'Cache-Control': MARKET_UNCACHEABLE_CONTROL }
		}
	)
}

function revisionResponse<
	T extends { marketSnapshotContext: { revision: string; source: string } }
>(requestRevision: number, data: T): NextResponse | null {
	const currentRevision = currentRevisionNumber(
		data.marketSnapshotContext.revision
	)
	if (currentRevision !== requestRevision) {
		return NextResponse.json(
			{
				error: 'revision_changed',
				revision: data.marketSnapshotContext.revision
			},
			{
				status: 409,
				headers: { 'Cache-Control': MARKET_UNCACHEABLE_CONTROL }
			}
		)
	}
	return null
}

export async function handleMarketPlayers(
	request: Request
): Promise<NextResponse> {
	const parsed = parseMarketPlayersParams(new URL(request.url).searchParams)
	if ('error' in parsed) return invalid(parsed.error)
	const startedAt = Date.now()
	try {
		const data = await executeQuery<MarketPlayersResponse>(
			GET_MARKET_PLAYERS,
			{
				search: parsed.search,
				limit: parsed.limit
			},
			{
				cache: 'no-store',
				timeoutMs: 2_000,
				signal: request.signal,
				headers: ingressHeaders(request)
			}
		)
		const changed = revisionResponse(parsed.revision, data)
		if (changed) {
			logMarketRoute('players', 'revision_changed', startedAt, {
				source: data.marketSnapshotContext.source
			})
			return changed
		}
		logMarketRoute('players', 'success', startedAt, {
			source: data.marketSnapshotContext.source,
			rowCount: data.playersForPicker.items.length
		})
		return NextResponse.json(
			{
				revision: data.marketSnapshotContext.revision,
				...data.playersForPicker
			},
			{
				status: 200,
				headers: {
					'Cache-Control':
						data.marketSnapshotContext.source === 'DATA_PUBLICATION'
							? MARKET_PUBLIC_CACHE_CONTROL
							: MARKET_UNCACHEABLE_CONTROL
				}
			}
		)
	} catch (error) {
		logMarketRoute(
			'players',
			error instanceof GraphQLRequestError && error.status === 429
				? 'rate_limited'
				: 'failure',
			startedAt
		)
		console.error(
			'[market-players]',
			error instanceof Error ? error.name : 'unknown'
		)
		return upstreamFailure(error)
	}
}

export async function handleMarketHistory(
	request: Request
): Promise<NextResponse> {
	const parsed = parseMarketHistoryParams(new URL(request.url).searchParams)
	if ('error' in parsed) return invalid(parsed.error)
	const startedAt = Date.now()
	try {
		const data = await executeQuery<MarketHistoryResponse>(
			GET_MARKET_PRICE_HISTORY,
			{ playerId: parsed.playerId },
			{
				cache: 'no-store',
				timeoutMs: 2_000,
				signal: request.signal,
				headers: ingressHeaders(request)
			}
		)
		const changed = revisionResponse(parsed.revision, data)
		if (changed) {
			logMarketRoute('history', 'revision_changed', startedAt, {
				source: data.marketSnapshotContext.source
			})
			return changed
		}
		logMarketRoute('history', 'success', startedAt, {
			source: data.marketSnapshotContext.source,
			rowCount: data.playerValueHistory.length
		})
		return NextResponse.json(
			{
				revision: data.marketSnapshotContext.revision,
				items: data.playerValueHistory
			},
			{
				status: 200,
				headers: {
					'Cache-Control':
						data.marketSnapshotContext.source === 'DATA_PUBLICATION'
							? MARKET_PUBLIC_CACHE_CONTROL
							: MARKET_UNCACHEABLE_CONTROL
				}
			}
		)
	} catch (error) {
		logMarketRoute(
			'history',
			error instanceof GraphQLRequestError && error.status === 429
				? 'rate_limited'
				: 'failure',
			startedAt
		)
		console.error(
			'[market-history]',
			error instanceof Error ? error.name : 'unknown'
		)
		return upstreamFailure(error)
	}
}

export async function handleMarketAvailability(
	request: Request
): Promise<NextResponse> {
	const parsed = parseMarketAvailabilityParams(
		new URL(request.url).searchParams
	)
	if ('error' in parsed) return invalid(parsed.error)
	const startedAt = Date.now()
	try {
		const data = await executeQuery<MarketAvailabilityResponse>(
			GET_MARKET_AVAILABILITY,
			{ days: parsed.days },
			{
				cache: 'no-store',
				timeoutMs: 2_000,
				signal: request.signal,
				headers: ingressHeaders(request)
			}
		)
		const changed = revisionResponse(parsed.revision, data)
		if (changed) {
			logMarketRoute('availability', 'revision_changed', startedAt, {
				source: data.marketSnapshotContext.source
			})
			return changed
		}
		logMarketRoute('availability', 'success', startedAt, {
			source: data.marketSnapshotContext.source,
			rowCount: data.marketPulse.availabilityUpdates.length
		})
		return NextResponse.json(
			{
				revision: data.marketSnapshotContext.revision,
				items: data.marketPulse.availabilityUpdates
			},
			{
				status: 200,
				headers: {
					'Cache-Control':
						data.marketSnapshotContext.source === 'DATA_PUBLICATION'
							? MARKET_PUBLIC_CACHE_CONTROL
							: MARKET_UNCACHEABLE_CONTROL
				}
			}
		)
	} catch (error) {
		logMarketRoute(
			'availability',
			error instanceof GraphQLRequestError && error.status === 429
				? 'rate_limited'
				: 'failure',
			startedAt
		)
		console.error(
			'[market-availability]',
			error instanceof Error ? error.name : 'unknown'
		)
		return upstreamFailure(error)
	}
}
