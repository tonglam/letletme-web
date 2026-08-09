'use client'

import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
	type ReactNode,
} from 'react'

const MAX_OPEN_GAMEWEEKS = 8

export interface TournamentGameweekWorkspaceValue {
	/** Open GW tabs in open order (left → right). Always length >= 1 when seeded. */
	openGameweeks: number[]
	/** Last focused GW (valid while viewing Season too). */
	activeGameweek: number
	/** Pin / focus a GW tab and show its content. */
	openGameweek: (gameweek: number) => void
	/** Replace active GW tab (selector default) or focus if already open. */
	selectGameweek: (gameweek: number) => void
	/** Close a GW tab; no-op when only one remains. */
	closeGameweek: (gameweek: number) => void
	canCloseGameweek: (gameweek: number) => boolean
}

const TournamentGameweekWorkspaceContext =
	createContext<TournamentGameweekWorkspaceValue | null>(null)

function clampGw(gw: number, maxGw: number): number {
	if (!Number.isFinite(gw) || gw < 1) return 0
	const floor = Math.floor(gw)
	if (maxGw > 0) return Math.min(floor, maxGw)
	return floor
}

function uniqueAppend(list: number[], gw: number): number[] {
	if (list.includes(gw)) return list
	const next = [...list, gw]
	if (next.length <= MAX_OPEN_GAMEWEEKS) return next
	return next.slice(next.length - MAX_OPEN_GAMEWEEKS)
}

interface ProviderProps {
	maxGw: number
	initialGameweek: number
	/**
	 * @param gameweek - new active GW
	 * @param enterGameweekView - true → land on that GW content; false → only retarget data/URL gw
	 */
	onActiveGameweekChange: (
		gameweek: number,
		enterGameweekView: boolean,
	) => void
	children: ReactNode
}

export function TournamentGameweekWorkspaceProvider({
	maxGw,
	initialGameweek,
	onActiveGameweekChange,
	children,
}: ProviderProps) {
	const seed = clampGw(initialGameweek, maxGw) || clampGw(maxGw, maxGw) || 1
	const [openGameweeks, setOpenGameweeks] = useState<number[]>(() =>
		seed > 0 ? [seed] : [],
	)
	const [activeGameweek, setActiveGameweek] = useState(seed)

	const setActive = useCallback(
		(gw: number, enterGameweekView: boolean) => {
			setActiveGameweek(gw)
			onActiveGameweekChange(gw, enterGameweekView)
		},
		[onActiveGameweekChange],
	)

	const openGameweek = useCallback(
		(raw: number) => {
			const gw = clampGw(raw, maxGw)
			if (gw < 1) return
			setOpenGameweeks(prev => uniqueAppend(prev, gw))
			setActive(gw, true)
		},
		[maxGw, setActive],
	)

	const selectGameweek = useCallback(
		(raw: number) => {
			const gw = clampGw(raw, maxGw)
			if (gw < 1) return
			setOpenGameweeks(prev => {
				if (prev.includes(gw)) return prev
				if (prev.length === 0) return [gw]
				const idx = prev.indexOf(activeGameweek)
				if (idx >= 0) {
					const next = [...prev]
					next[idx] = gw
					return next.filter((g, i) => next.indexOf(g) === i)
				}
				return uniqueAppend(prev, gw)
			})
			setActive(gw, true)
		},
		[activeGameweek, maxGw, setActive],
	)

	const closeGameweek = useCallback(
		(raw: number) => {
			const gw = clampGw(raw, maxGw)
			if (gw < 1) return
			setOpenGameweeks(prev => {
				if (prev.length <= 1) return prev
				if (!prev.includes(gw)) return prev
				const next = prev.filter(g => g !== gw)
				if (activeGameweek === gw) {
					const closedIdx = prev.indexOf(gw)
					const fallback =
						next[Math.min(closedIdx, next.length - 1)] ?? next[0]
					// Retarget only — keep Season if user was on Season
					setActive(fallback, false)
				}
				return next
			})
		},
		[activeGameweek, maxGw, setActive],
	)

	const canCloseGameweek = useCallback(
		(_gameweek: number) => openGameweeks.length > 1,
		[openGameweeks.length],
	)

	const value = useMemo<TournamentGameweekWorkspaceValue>(
		() => ({
			openGameweeks,
			activeGameweek,
			openGameweek,
			selectGameweek,
			closeGameweek,
			canCloseGameweek,
		}),
		[
			openGameweeks,
			activeGameweek,
			openGameweek,
			selectGameweek,
			closeGameweek,
			canCloseGameweek,
		],
	)

	return (
		<TournamentGameweekWorkspaceContext.Provider value={value}>
			{children}
		</TournamentGameweekWorkspaceContext.Provider>
	)
}

export function useTournamentGameweekWorkspace(): TournamentGameweekWorkspaceValue {
	const ctx = useContext(TournamentGameweekWorkspaceContext)
	if (!ctx) {
		throw new Error(
			'useTournamentGameweekWorkspace must be used within TournamentGameweekWorkspaceProvider',
		)
	}
	return ctx
}

export function useTournamentGameweekWorkspaceOptional(): TournamentGameweekWorkspaceValue | null {
	return useContext(TournamentGameweekWorkspaceContext)
}
