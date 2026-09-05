'use client'

import { reportBrowserPerformanceMetric } from '@/lib/analytics/client-vitals'
import {
	cacheStatusFromHeaders,
	createPerformanceCorrelationId,
	type PerformanceCorrelation,
	type PlayerStatsCacheStatus
} from '@/lib/analytics/performance-correlation'
import type {
	PlayerDetailDataAvailability,
	PlayerStatsDeskSection
} from '@/lib/graphql/operations/players'
import {
	PLAYER_STATS_DESK_PUBLIC_CACHE_VERSION,
	type PlayerStatsDeskResponse
} from '@/lib/player-stats-desk'

const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_MAX_ENTRIES = 50

type DeskRequest = {
	playerIds: number[]
	eventId: number
	horizon?: number
	section: PlayerStatsDeskSection
}

type PendingDeskRequest = {
	controller: AbortController
	promise: Promise<PlayerStatsDeskResponse>
	signals: Set<AbortSignal>
	hasUnabortableConsumer: boolean
	cleanups: Array<() => void>
}

type DeskRequestOptions = PerformanceCorrelation & {
	bypassCache?: boolean
	signal?: AbortSignal
}

const responseCache = new Map<
	string,
	{ expiresAt: number; response: PlayerStatsDeskResponse }
>()
const pendingRequests = new Map<string, PendingDeskRequest>()

function canonicalRequest(input: DeskRequest) {
	return {
		...input,
		playerIds: Array.from(new Set(input.playerIds)).sort(
			(left, right) => left - right
		),
		horizon: input.horizon ?? 5
	}
}

function requestKey(input: DeskRequest): string {
	const request = canonicalRequest(input)
	return `${request.playerIds.join(',')}:${request.eventId}:${request.horizon}:${request.section}`
}

function readCache(key: string): PlayerStatsDeskResponse | undefined {
	const cached = responseCache.get(key)
	if (!cached) return undefined
	if (cached.expiresAt <= Date.now()) {
		responseCache.delete(key)
		return undefined
	}
	responseCache.delete(key)
	responseCache.set(key, cached)
	return cached.response
}

function writeCache(key: string, response: PlayerStatsDeskResponse): void {
	if (
		response.unavailablePlayerIds.length > 0 ||
		!responseIsAuthoritative(response)
	)
		return
	responseCache.set(key, {
		expiresAt: Date.now() + CACHE_TTL_MS,
		response
	})
	while (responseCache.size > CACHE_MAX_ENTRIES) {
		const oldest = responseCache.keys().next().value
		if (typeof oldest !== 'string') break
		responseCache.delete(oldest)
	}
}

const responseIsAuthoritative = (
	response: PlayerStatsDeskResponse
): boolean => {
	if (response.section === 'overview') {
		return response.entries.every(entry => {
			const availability = entry.overview?.dataAvailability
			return Boolean(availability && isAuthoritativeAvailability(availability))
		})
	}
	if (response.section === 'context') return true
	if (response.section === 'process') {
		return response.entries.every(entry => {
			const statuses = entry.fieldStatuses ?? {}
			return (
				(statuses.evidence ??
					(entry.evidence != null ? 'AVAILABLE' : 'NOT_FOUND')) ===
					'AVAILABLE' &&
				(statuses.state ??
					(entry.state != null ? 'AVAILABLE' : 'NOT_FOUND')) === 'AVAILABLE' &&
				entry.evidence != null &&
				entry.state != null &&
				isAuthoritativeAvailability(entry.evidence.dataAvailability)
			)
		})
	}
	return response.entries.every(entry => {
		if (!entry.evidence) return false
		const availability = entry.evidence.dataAvailability
		return Boolean(availability && isAuthoritativeAvailability(availability))
	})
}

function isAuthoritativeAvailability(
	availability: PlayerDetailDataAvailability | null | undefined
): boolean {
	return (
		availability?.isFullyAuthoritative === true &&
		[
			availability.seasonStats,
			availability.market,
			availability.historicalTeam,
			availability.fixtures,
			availability.recentGameweeks
		].every(
			section =>
				section != null &&
				['READY', 'EMPTY', 'NOT_APPLICABLE'].includes(section.state)
		)
	)
}

function reportDeskResponse(
	startedAt: number,
	context: PerformanceCorrelation,
	cacheStatus: PlayerStatsCacheStatus
): void {
	if (typeof window === 'undefined') return
	const value = Math.max(0, performance.now() - startedAt)
	reportBrowserPerformanceMetric({
		name: 'PLAYER_DESK_RESPONSE',
		value,
		delta: value,
		rating:
			value <= 500 ? 'good' : value <= 1_500 ? 'needs-improvement' : 'poor',
		metricId: createPerformanceCorrelationId('desk'),
		page: window.location.pathname,
		audienceHint: 'public',
		navigationId: context.navigationId,
		interactionId: context.interactionId,
		cacheStatus
	})
}

function attachConsumer(
	pending: PendingDeskRequest,
	signal: AbortSignal | undefined
): void {
	if (!signal) {
		pending.hasUnabortableConsumer = true
		return
	}
	pending.signals.add(signal)
	const maybeAbort = () => {
		if (
			!pending.hasUnabortableConsumer &&
			Array.from(pending.signals).every(candidate => candidate.aborted)
		) {
			pending.controller.abort()
		}
	}
	if (signal.aborted) maybeAbort()
	else {
		signal.addEventListener('abort', maybeAbort, { once: true })
		pending.cleanups.push(() => signal.removeEventListener('abort', maybeAbort))
	}
}

export function primePlayerStatsDeskCache(
	input: DeskRequest,
	response: PlayerStatsDeskResponse
): void {
	writeCache(requestKey(input), response)
}

export async function requestPlayerStatsDesk(
	input: DeskRequest,
	options: DeskRequestOptions = {}
): Promise<PlayerStatsDeskResponse> {
	const request = canonicalRequest(input)
	const key = requestKey(request)
	const startedAt = typeof performance === 'undefined' ? 0 : performance.now()
	if (options.bypassCache) responseCache.delete(key)
	const cached = options.bypassCache ? undefined : readCache(key)
	if (cached) {
		reportDeskResponse(startedAt, options, 'hit')
		return cached
	}
	const existing = pendingRequests.get(key)
	if (existing && options.bypassCache && !existing.controller.signal.aborted) {
		existing.controller.abort()
		pendingRequests.delete(key)
	}
	if (existing && !options.bypassCache && !existing.controller.signal.aborted) {
		attachConsumer(existing, options.signal)
		return existing.promise
	}
	if (existing) pendingRequests.delete(key)

	const controller = new AbortController()
	const search = new URLSearchParams({
		playerIds: request.playerIds.join(','),
		eventId: String(request.eventId),
		horizon: String(request.horizon),
		section: request.section,
		cacheVersion: PLAYER_STATS_DESK_PUBLIC_CACHE_VERSION
	})
	const requestHeaders: Record<string, string> = {}
	if (options.navigationId) {
		requestHeaders['X-LetLetMe-Navigation-Id'] = options.navigationId
	}
	if (options.interactionId) {
		requestHeaders['X-LetLetMe-Interaction-Id'] = options.interactionId
	}
	if (options.bypassCache) requestHeaders['Cache-Control'] = 'no-cache'
	const pending: PendingDeskRequest = {
		controller,
		promise: Promise.resolve(null as never),
		signals: new Set(),
		hasUnabortableConsumer: false,
		cleanups: []
	}
	attachConsumer(pending, options.signal)
	pending.promise = fetch(`/api/player-stats/desk?${search.toString()}`, {
		method: 'GET',
		credentials: 'same-origin',
		headers: requestHeaders,
		cache: options.bypassCache ? 'no-store' : 'default',
		signal: controller.signal
	})
		.then(async response => {
			const responseCacheStatus = cacheStatusFromHeaders(response.headers)
			const body = await response.json().catch(() => null)
			if (!response.ok || body == null || typeof body !== 'object') {
				reportDeskResponse(
					startedAt,
					options,
					responseCacheStatus === 'unknown' ? 'bypass' : responseCacheStatus
				)
				const error = new Error(
					`Player stats request failed with status ${response.status}`
				)
				;(error as Error & { status?: number }).status = response.status
				throw error
			}
			const result = body as PlayerStatsDeskResponse
			writeCache(key, result)
			reportDeskResponse(startedAt, options, responseCacheStatus)
			return result
		})
		.finally(() => {
			pending.cleanups.forEach(cleanup => cleanup())
			if (pendingRequests.get(key) === pending) pendingRequests.delete(key)
		})
	pendingRequests.set(key, pending)
	return pending.promise
}

export function clearPlayerStatsDeskClientCache(): void {
	responseCache.clear()
	for (const pending of Array.from(pendingRequests.values())) {
		pending.controller.abort()
	}
	pendingRequests.clear()
}
