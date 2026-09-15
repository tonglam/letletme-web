'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { FixturePlanningMarketSignals } from '@/lib/graphql/operations/market'
import type { PersonalSquadSeed } from '@/lib/squad-picks'

type State = {
	navigationId: string
	squad: PersonalSquadSeed | null
	market: FixturePlanningMarketSignals | null
}
type Update = { squad: PersonalSquadSeed } | { market: Partial<FixturePlanningMarketSignals> }
const Context = createContext<(State & { commit: (id: string, update: Update) => void }) | null>(null)

export function FixturesSeedProvider({ navigationId, children }: { navigationId: string; children: ReactNode }) {
	const [state, setState] = useState<State>({ navigationId, squad: null, market: null })
	const current = useMemo(() => state.navigationId === navigationId ? state : { navigationId, squad: null, market: null }, [state, navigationId])
	if (current !== state) setState(current)
	const commit = useCallback((id: string, update: Update) => {
		setState(previous => {
			if (previous.navigationId !== id) return previous
			if ('squad' in update) return { ...previous, squad: update.squad }
			return { ...previous, market: {
				mostSelected: [], transferMovers: [], gameweekOwnership: null, rollingOwnership: null,
				...previous.market, ...update.market
			} }
		})
	}, [])
	const value = useMemo(() => ({ ...current, commit }), [current, commit])
	return <Context.Provider value={value}>{children}</Context.Provider>
}

export function FixturesSeedCommit({ navigationId, update }: { navigationId: string; update: Update }) {
	const { commit } = useFixturesSeed()
	useEffect(() => { commit(navigationId, update) }, [commit, navigationId, update])
	return null
}

export function useFixturesSeed() {
	const context = useContext(Context)
	if (!context) throw new Error('Fixtures seed provider is missing')
	return context
}
