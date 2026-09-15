'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { PersonalSquadSeed } from '@/lib/squad-picks'

type State = { navigationId: string; seed: PersonalSquadSeed | null }
const Context = createContext<(State & { commit: (id: string, seed: PersonalSquadSeed) => void }) | null>(null)

export function PriceChangesPersonalSeedProvider({ navigationId, children }: { navigationId: string; children: ReactNode }) {
	const [state, setState] = useState<State>({ navigationId, seed: null })
	const current = useMemo(() => state.navigationId === navigationId ? state : { navigationId, seed: null }, [state, navigationId])
	if (current !== state) setState(current)
	const commit = useCallback((id: string, seed: PersonalSquadSeed) => {
		setState(previous => previous.navigationId === id ? { navigationId: id, seed } : previous)
	}, [])
	const value = useMemo(() => ({ ...current, commit }), [current, commit])
	return <Context.Provider value={value}>{children}</Context.Provider>
}

export function PriceChangesPersonalSeedCommit({ navigationId, seed }: { navigationId: string; seed: PersonalSquadSeed }) {
	const { commit } = usePriceChangesPersonalSeed()
	useEffect(() => { commit(navigationId, seed) }, [commit, navigationId, seed])
	return null
}

export function usePriceChangesPersonalSeed() {
	const context = useContext(Context)
	if (!context) throw new Error('Price Changes personal seed provider is missing')
	return context
}
