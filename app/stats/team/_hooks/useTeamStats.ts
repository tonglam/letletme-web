'use client'

import type { EntryEventResult } from '@/lib/graphql/operations/entries'
import { useEffect, useRef, useState } from 'react'
import {
	entryEventCache,
	entryEventCacheKey,
	getEntryEventResultCached,
	getEntryHistoryCached,
	getTransferHistoryCached,
	isTeamStatsTab,
	LIVE_CACHE_TTL_MS,
	mapApiDataToTeamStats,
	type TeamStatsTab,
	type TeamStatsViewModel,
} from '../_lib/team-stats-model'
import { useTranslations } from 'next-intl'

interface UseTeamStatsOptions {
	entryId: number
	currentGameweek: number
	initialEntryEventResult: EntryEventResult | null
	initialError: string | null
	initialRequestComplete: boolean
}

export function useTeamStats({
	entryId,
	currentGameweek: initialCurrentGameweek,
	initialEntryEventResult,
	initialError,
	initialRequestComplete,
}: UseTeamStatsOptions) {
	const t = useTranslations('TeamStats')
	const [currentGameweek, setCurrentGameweek] = useState(initialCurrentGameweek)
	const [selectedGameweek, setSelectedGameweek] = useState(initialCurrentGameweek)
	const [activeTab, setActiveTab] = useState<TeamStatsTab>('squad')
	const [teamStats, setTeamStats] = useState<TeamStatsViewModel | null>(() =>
		initialEntryEventResult ? mapApiDataToTeamStats(initialEntryEventResult, [], [], []) : null,
	)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(initialError)
	const [emptyStateMessage, setEmptyStateMessage] = useState<string | null>(
		initialRequestComplete && !initialEntryEventResult && initialCurrentGameweek
			? t('noStatsForGameweek', { gameweek: initialCurrentGameweek })
			: null,
	)
	const requestIdRef = useRef(0)
	const initialRequestKeyRef = useRef(
		initialRequestComplete && initialCurrentGameweek
			? entryEventCacheKey(entryId, initialCurrentGameweek)
			: null,
	)

	useEffect(() => {
		const requestKey = entryEventCacheKey(entryId, selectedGameweek)
		if (activeTab === 'squad' && initialRequestKeyRef.current === requestKey) {
			initialRequestKeyRef.current = null
			entryEventCache.set(requestKey, {
				value: initialEntryEventResult,
				expiresAt: Date.now() + LIVE_CACHE_TTL_MS,
			})
			return
		}

		const requestId = requestIdRef.current + 1
		requestIdRef.current = requestId

		const loadTeamStats = async () => {
			try {
				setIsLoading(true)
				setError(null)
				setEmptyStateMessage(null)
				const historyRequired = activeTab === 'history' || activeTab === 'chips' || activeTab === 'transfer'
				const transferWarning = { message: null as string | null }
				const [entryHistory, entryEventResult, entryTransferHistory] = await Promise.all([
					historyRequired ? getEntryHistoryCached(entryId) : Promise.resolve(null),
					getEntryEventResultCached(entryId, selectedGameweek),
					activeTab === 'transfer'
						? getTransferHistoryCached(entryId).catch((transferError) => {
							console.warn('Transfer details unavailable:', transferError)
							transferWarning.message = t('transferDetailsUnavailable')
							return []
						})
						: Promise.resolve(null),
				])

				if (requestId !== requestIdRef.current) return
				if (entryHistory) {
					setCurrentGameweek(
						entryHistory.results.reduce((maxEventId, item) => Math.max(maxEventId, item.eventId), 1),
					)
				}
				if (!entryEventResult) {
					setTeamStats(null)
					setEmptyStateMessage(t('noStatsForGameweek', { gameweek: selectedGameweek }))
					return
				}
				setError(transferWarning.message)
				setTeamStats(
					mapApiDataToTeamStats(
						entryEventResult,
						entryHistory?.results ?? [],
						entryHistory?.history ?? [],
						entryTransferHistory ?? [],
					),
				)
			} catch (loadError) {
				if (requestId !== requestIdRef.current) return
				console.error('Failed to load team stats:', loadError)
				setError(t('loadFailed'))
				setTeamStats(null)
			} finally {
				if (requestId === requestIdRef.current) setIsLoading(false)
			}
		}

		void loadTeamStats()
		return () => {
			requestIdRef.current += 1
		}
	}, [activeTab, entryId, initialEntryEventResult, selectedGameweek, t])

	return {
		activeTab,
		currentGameweek,
		emptyStateMessage,
		error,
		isLoading,
		selectedGameweek,
		setActiveTab: (value: string) => {
			if (isTeamStatsTab(value)) setActiveTab(value)
		},
		setSelectedGameweek,
		teamStats,
	}
}
