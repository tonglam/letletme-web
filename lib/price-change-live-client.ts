'use client'

import type {
	PriceChangeBoard,
	PriceChangeLiveBoard,
	PriceChangeLiveCursor,
	PriceChangeLiveState
} from '@/lib/graphql/operations/price-changes'
import { useEffect, useRef } from 'react'

const HOT_WINDOW_BEFORE_MS = 30_000
const HOT_WINDOW_AFTER_MS = 5 * 60_000
const HOT_POLL_MS = 2_000
const IDLE_POLL_MS = 60_000
const HIDDEN_POLL_MS = 30_000
const LIVE_DISABLED_REFRESH_MS = 5 * 60_000

export function isPriceChangeLiveEnabled(): boolean {
	const raw = process.env.NEXT_PUBLIC_PRICE_CHANGE_LIVE_ENABLED
	if (raw === undefined) return process.env.NODE_ENV !== 'production'
	return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

type LiveCursorResponse = PriceChangeLiveCursor
type LiveBoardResponse = PriceChangeLiveBoard

function isLiveCursor(value: unknown): value is LiveCursorResponse {
	if (value == null || typeof value !== 'object') return false
	const cursor = value as Partial<LiveCursorResponse>
	return (
		typeof cursor.seasonCode === 'string' &&
		(cursor.revision === null || typeof cursor.revision === 'string') &&
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
		(live.state === 'PROVISIONAL' ||
			live.state === 'DURABLE' ||
			live.state === 'UNAVAILABLE') &&
		live.board != null &&
		typeof live.board === 'object' &&
		Array.isArray(live.board.players)
	)
}

function nextDeadlineMs(board: PriceChangeBoard): number | null {
	const now = Date.now()
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

function isHotWindow(board: PriceChangeBoard): boolean {
	return nextDeadlineMs(board) !== null
}

function pollTimeoutMs(board: PriceChangeBoard): number {
	if (typeof document !== 'undefined' && document.hidden) return HIDDEN_POLL_MS
	return isHotWindow(board) ? HOT_POLL_MS : IDLE_POLL_MS
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

export function usePriceChangeLiveBoard({
	board,
	onUpdate
}: {
	board: PriceChangeBoard
	onUpdate: (board: PriceChangeBoard, state: PriceChangeLiveState) => void
}): void {
	const boardRef = useRef(board)
	const durableBoardRef = useRef(board)
	const onUpdateRef = useRef(onUpdate)
	const revisionRef = useRef(board.revision)
	const stateRef = useRef<PriceChangeLiveState>('DURABLE')

	useEffect(() => {
		boardRef.current = board
		durableBoardRef.current = board
		revisionRef.current = board.revision
		stateRef.current = 'DURABLE'
	}, [board])

	useEffect(() => {
		onUpdateRef.current = onUpdate
	}, [onUpdate])

	useEffect(() => {
		if (!isPriceChangeLiveEnabled()) return
		let stopped = false
		let timer: number | null = null
		let requestInFlight = false

		const schedule = (delay: number) => {
			if (stopped) return
			timer = window.setTimeout(() => void poll(), delay)
		}

		const poll = async () => {
			if (stopped || requestInFlight) return
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
							// the next poll. Restore the durable seed immediately instead
							// of leaving expired prices on screen indefinitely.
							const fallback = durableBoardRef.current
							if (
								stateRef.current !== cursor.state ||
								boardRef.current !== fallback
							) {
								revisionRef.current = fallback.revision
								stateRef.current = cursor.state
								boardRef.current = fallback
								onUpdateRef.current(fallback, cursor.state)
							}
						} else if (
							cursor.revision !== revisionRef.current ||
							cursor.state !== stateRef.current
						) {
							const url =
								cursor.state === 'PROVISIONAL'
									? `/api/price-changes/live-board?revision=${encodeURIComponent(cursor.revision)}`
									: '/api/price-changes/live-board'
							const live = await fetchJson<LiveBoardResponse>(url, 2_500)
							const revisionMatches =
								cursor.state !== 'PROVISIONAL' ||
								live?.revision === cursor.revision
							if (
								isLiveBoard(live) &&
								revisionMatches &&
								live.state !== 'UNAVAILABLE'
							) {
								revisionRef.current = live.revision
								stateRef.current = live.state
								boardRef.current = live.board
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
				if (!stopped) schedule(pollTimeoutMs(boardRef.current))
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

export { LIVE_DISABLED_REFRESH_MS }
