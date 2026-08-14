'use client'

import type { PlayerStatsDeskSection } from '@/lib/graphql/operations/players'
import type { PlayerStatsDeskResponse } from '@/lib/player-stats-desk'

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
	if (response.unavailablePlayerIds.length > 0) return
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
	options: { signal?: AbortSignal } = {}
): Promise<PlayerStatsDeskResponse> {
	const request = canonicalRequest(input)
	const key = requestKey(request)
	const cached = readCache(key)
	if (cached) return cached
	const existing = pendingRequests.get(key)
	if (existing && !existing.controller.signal.aborted) {
		attachConsumer(existing, options.signal)
		return existing.promise
	}
	if (existing) pendingRequests.delete(key)

	const controller = new AbortController()
	const search = new URLSearchParams({
		playerIds: request.playerIds.join(','),
		eventId: String(request.eventId),
		horizon: String(request.horizon),
		section: request.section
	})
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
		signal: controller.signal
	})
		.then(async response => {
			const body = await response.json().catch(() => null)
			if (!response.ok || body == null || typeof body !== 'object') {
				throw new Error(
					`Player stats request failed with status ${response.status}`
				)
			}
			const result = body as PlayerStatsDeskResponse
			writeCache(key, result)
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
