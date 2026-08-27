'use client'

import type {
	PriceChangeBoard,
	PriceChangeLiveBoard,
	PriceChangeLiveCursor,
	PriceChangeLiveState
} from '@/lib/graphql/operations/price-changes'
import { useEffect, useRef } from 'react'

const HOT_WINDOW_BEFORE_MS = 5 * 60_000
const HOT_WINDOW_AFTER_MS = 5 * 60_000
const FINAL_WINDOW_BEFORE_MS = 10_000
const HOT_POLL_MS = 2_000
const FINAL_POLL_MS = 500
const IDLE_POLL_MS = 60_000
const LIVE_DISABLED_REFRESH_MS = 5 * 60_000

export function isPriceChangeLiveEnabled(): boolean {
	const raw = process.env.NEXT_PUBLIC_PRICE_CHANGE_LIVE_ENABLED
	if (raw === undefined) return process.env.NODE_ENV !== 'production'
	return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

type LiveCursorResponse = PriceChangeLiveCursor
type LiveBoardResponse = PriceChangeLiveBoard

export type PriceChangeLiveSeed = Pick<
	PriceChangeBoard,
	'revision' | 'deadline' | 'nextDeadlines'
>

function isLiveCursor(value: unknown): value is LiveCursorResponse {
	if (value == null || typeof value !== 'object') return false
	const cursor = value as Partial<LiveCursorResponse>
	return (
		typeof cursor.seasonCode === 'string' &&
		(cursor.revision === null || typeof cursor.revision === 'string') &&
		(cursor.sourceHash === null || typeof cursor.sourceHash === 'string') &&
		(cursor.state === 'PROVISIONAL' ||
			cursor.state === 'DURABLE' ||
			cursor.state === 'UNAVAILABLE')
	)
}

function isLiveBoard(value: unknown): value is LiveBoardResponse {
	if (value == null || typeof value !== 'object') return false
	const live = value as Partial<LiveBoardResponse>
	return (
		typeof live.revision === 'string' &&
		(live.sourceHash === null || typeof live.sourceHash === 'string') &&
		(live.state === 'PROVISIONAL' ||
			live.state === 'DURABLE' ||
			live.state === 'UNAVAILABLE') &&
		live.board != null &&
		typeof live.board === 'object' &&
		Array.isArray(live.board.players)
	)
}

function nextDeadlineMs(
	board: Pick<PriceChangeBoard, 'deadline' | 'nextDeadlines'>,
	now: number = Date.now()
): number | null {
	const candidates = [board.deadline, ...board.nextDeadlines]
		.filter((value): value is string => typeof value === 'string')
		.map(value => Date.parse(value))
		.filter(timestamp => Number.isFinite(timestamp))
		.filter(
			timestamp =>
				timestamp - now <= HOT_WINDOW_BEFORE_MS &&
				timestamp - now >= -HOT_WINDOW_AFTER_MS
		)
	return (
		candidates.sort(
			(left, right) => Math.abs(left - now) - Math.abs(right - now)
		)[0] ?? null
	)
}

export function resolvePriceChangeLivePollPolicy(
	board: Pick<PriceChangeBoard, 'deadline' | 'nextDeadlines'>,
	now: number = Date.now(),
	retainedDeadline: number | null = null
): { delayMs: number; windowDeadline: number | null } {
	const retainedDeadlineIsActive =
		retainedDeadline !== null &&
		retainedDeadline - now <= HOT_WINDOW_BEFORE_MS &&
		retainedDeadline - now >= -HOT_WINDOW_AFTER_MS
	const deadline =
		nextDeadlineMs(board, now) ??
		(retainedDeadlineIsActive ? retainedDeadline : null)
	if (deadline === null) {
		return { delayMs: IDLE_POLL_MS, windowDeadline: null }
	}
	return {
		delayMs:
			deadline - now <= FINAL_WINDOW_BEFORE_MS ? FINAL_POLL_MS : HOT_POLL_MS,
		windowDeadline: deadline
	}
}

async function fetchJson<T>(
	url: string,
	timeoutMs: number,
	cache: RequestCache = 'no-store'
): Promise<T | null> {
	const controller = new AbortController()
	const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
	try {
		const response = await fetch(url, {
			cache,
			headers: { Accept: 'application/json' },
			signal: controller.signal
		})
		if (!response.ok) return null
		return (await response.json()) as T
	} catch {
		return null
	} finally {
		window.clearTimeout(timeout)
	}
}

export function usePriceChangeLiveUpdates({
	seed,
	durableBoard,
	onUpdate,
	onReset
}: {
	seed: PriceChangeLiveSeed
	durableBoard?: PriceChangeBoard
	onUpdate: (board: PriceChangeBoard, state: PriceChangeLiveState) => void
	onReset?: (state: PriceChangeLiveState) => void
}): void {
	const baseSeedRef = useRef(seed)
	const policySeedRef = useRef<PriceChangeLiveSeed>(seed)
	const durableBoardRef = useRef<PriceChangeBoard | null>(durableBoard ?? null)
	const onUpdateRef = useRef(onUpdate)
	const onResetRef = useRef(onReset)
	const revisionRef = useRef(seed.revision)
	const sourceHashRef = useRef<string | null>(null)
	const stateRef = useRef<PriceChangeLiveState>('DURABLE')
	const windowDeadlineRef = useRef<number | null>(null)

	useEffect(() => {
		baseSeedRef.current = seed
		policySeedRef.current = seed
		durableBoardRef.current = durableBoard ?? null
		revisionRef.current = seed.revision
		sourceHashRef.current = null
		stateRef.current = 'DURABLE'
	}, [durableBoard, seed])

	useEffect(() => {
		onUpdateRef.current = onUpdate
		onResetRef.current = onReset
	}, [onReset, onUpdate])

	useEffect(() => {
		if (!isPriceChangeLiveEnabled()) return
		let stopped = false
		let timer: number | null = null
		let requestInFlight = false

		const schedule = (delay: number) => {
			if (stopped || document.hidden) {
				timer = null
				return
			}
			timer = window.setTimeout(() => void poll(), delay)
		}

		const poll = async () => {
			if (stopped || requestInFlight) return
			const policyAtStart = resolvePriceChangeLivePollPolicy(
				policySeedRef.current,
				Date.now(),
				windowDeadlineRef.current
			)
			windowDeadlineRef.current = policyAtStart.windowDeadline
			requestInFlight = true
			try {
				if (!document.hidden) {
					const cursor = await fetchJson<LiveCursorResponse>(
						'/api/price-changes/live-cursor',
						1_500,
						'default'
					)
					if (isLiveCursor(cursor)) {
						if (!cursor.revision || cursor.state === 'UNAVAILABLE') {
							// A provisional snapshot can expire or be withdrawn before
							// the next poll. Restore a full durable board when one is
							// available, otherwise let lightweight consumers reset to
							// their server-rendered projection.
							const fallback = durableBoardRef.current
							const fallbackSeed = fallback ?? baseSeedRef.current
							if (
								stateRef.current !== cursor.state ||
								revisionRef.current !== fallbackSeed.revision ||
								sourceHashRef.current !== null
							) {
								revisionRef.current = fallbackSeed.revision
								sourceHashRef.current = null
								stateRef.current = cursor.state
								policySeedRef.current = fallbackSeed
								if (fallback) {
									onUpdateRef.current(fallback, cursor.state)
								} else {
									onResetRef.current?.(cursor.state)
								}
							}
						} else if (
							cursor.revision !== revisionRef.current ||
							cursor.state !== stateRef.current ||
							(cursor.state === 'PROVISIONAL' &&
								cursor.sourceHash !== sourceHashRef.current)
						) {
							const url =
								cursor.state === 'PROVISIONAL'
									? `/api/price-changes/live-board?revision=${encodeURIComponent(cursor.revision)}&sourceHash=${encodeURIComponent(cursor.sourceHash ?? '')}`
									: '/api/price-changes/live-board'
							const live = await fetchJson<LiveBoardResponse>(url, 2_500)
							const revisionMatches =
								cursor.state !== 'PROVISIONAL' ||
								(live?.revision === cursor.revision &&
									live.sourceHash === cursor.sourceHash)
							if (
								isLiveBoard(live) &&
								revisionMatches &&
								live.state !== 'UNAVAILABLE'
							) {
								revisionRef.current = live.revision
								sourceHashRef.current = live.sourceHash
								stateRef.current = live.state
								policySeedRef.current = live.board
								if (live.state === 'DURABLE') {
									durableBoardRef.current = live.board
								}
								onUpdateRef.current(live.board, live.state)
							}
						}
					}
				}
			} finally {
				requestInFlight = false
				if (!stopped) {
					const policy = resolvePriceChangeLivePollPolicy(
						policySeedRef.current,
						Date.now(),
						windowDeadlineRef.current
					)
					windowDeadlineRef.current = policy.windowDeadline
					schedule(policy.delayMs)
				}
			}
		}

		const onVisibilityChange = () => {
			if (!document.hidden) {
				if (timer !== null) window.clearTimeout(timer)
				timer = null
				void poll()
			}
		}
		document.addEventListener('visibilitychange', onVisibilityChange)
		window.addEventListener('focus', onVisibilityChange)
		void poll()
		return () => {
			stopped = true
			if (timer !== null) window.clearTimeout(timer)
			document.removeEventListener('visibilitychange', onVisibilityChange)
			window.removeEventListener('focus', onVisibilityChange)
		}
	}, [])
}

export function usePriceChangeLiveBoard({
	board,
	onUpdate
}: {
	board: PriceChangeBoard
	onUpdate: (board: PriceChangeBoard, state: PriceChangeLiveState) => void
}): void {
	usePriceChangeLiveUpdates({
		seed: board,
		durableBoard: board,
		onUpdate
	})
}

export { LIVE_DISABLED_REFRESH_MS }
