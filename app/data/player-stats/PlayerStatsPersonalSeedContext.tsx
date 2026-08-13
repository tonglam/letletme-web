'use client'

import type { PlayerStatsPersonalSeed } from '@/lib/player-stats-seed'
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode
} from 'react'

type PersonalSeedContextValue = {
	seed: PlayerStatsPersonalSeed | null
	resolved: boolean
	commit: (seed: PlayerStatsPersonalSeed | null) => void
}

const PersonalSeedContext = createContext<PersonalSeedContextValue | null>(null)

export function PlayerStatsPersonalSeedProvider({
	children
}: {
	children: ReactNode
}) {
	const [seed, setSeed] = useState<PlayerStatsPersonalSeed | null>(null)
	const [resolved, setResolved] = useState(false)
	const commit = useCallback((nextSeed: PlayerStatsPersonalSeed | null) => {
		setSeed(nextSeed)
		setResolved(true)
	}, [])
	const value = useMemo<PersonalSeedContextValue>(
		() => ({
			seed,
			resolved,
			commit
		}),
		[commit, resolved, seed]
	)

	return (
		<PersonalSeedContext.Provider value={value}>
			{children}
		</PersonalSeedContext.Provider>
	)
}

export function PlayerStatsPersonalSeedCommit({
	seed
}: {
	seed: PlayerStatsPersonalSeed | null
}) {
	const context = useContext(PersonalSeedContext)
	if (!context) throw new Error('PlayerStats personal seed provider is missing')
	const commit = context.commit

	useEffect(() => {
		commit(seed)
	}, [commit, seed])

	return null
}

export function usePlayerStatsPersonalSeed() {
	const context = useContext(PersonalSeedContext)
	if (!context) throw new Error('PlayerStats personal seed provider is missing')
	return { seed: context.seed, resolved: context.resolved }
}
