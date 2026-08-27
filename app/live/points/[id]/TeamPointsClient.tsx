'use client'

import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { Button } from '@/components/ui/button'
import type {
	EntryOverallSnapshot,
	EntryLookupStatus,
	EntryPersistenceState
} from '@/lib/graphql/operations/entries'
import type {
	LiveCalcData,
	LiveSnapshotStatus
} from '@/lib/graphql/operations/live'
import { Link } from '@/i18n/navigation'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_ENTRY,
	type EntrySummaryResponse
} from '@/lib/graphql/operations/entries'
import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { LivePointsDashboard } from '../_components/LivePointsDashboard'
import { LivePointsLoading } from '../_components/LivePointsLoading'
import { useLivePoints } from '../_hooks/useLivePoints'

interface TeamPointsClientProps {
	entryId: number
	tournamentId?: string
	from?: 'home'
	initialEventId: number
	initialSelectedGameweek?: number
	initialLiveData?: LiveCalcData
	initialSnapshot?: LiveSnapshotStatus | null
	initialOverall?: EntryOverallSnapshot
	initialEntryLookupStatus?: EntryLookupStatus
	initialEntryPersistenceState?: EntryPersistenceState | null
}

export default function TeamPointsClient({
	entryId,
	tournamentId,
	from,
	initialEventId,
	initialSelectedGameweek,
	initialLiveData,
	initialSnapshot,
	initialOverall,
	initialEntryLookupStatus,
	initialEntryPersistenceState
}: TeamPointsClientProps) {
	const t = useTranslations('LivePoints')
	const livePoints = useLivePoints({
		initialEntryId: entryId,
		initialEventId,
		initialSelectedGameweek,
		initialLiveData,
		initialSnapshot
	})
	const [overall, setOverall] = useState(initialOverall)
	const [entryLookupStatus, setEntryLookupStatus] = useState<
		EntryLookupStatus | undefined
	>(initialEntryLookupStatus)
	const [entryPersistenceState, setEntryPersistenceState] = useState<
		EntryPersistenceState | null | undefined
	>(initialEntryPersistenceState)
	const [entryLookupReloadRevision, setEntryLookupReloadRevision] = useState(0)
	const overallLoadedKeyRef = useRef<string | null>(
		initialOverall != null ? `${entryId}:${initialEventId}` : null
	)

	useEffect(() => {
		setOverall(initialOverall)
		setEntryLookupStatus(initialEntryLookupStatus)
		setEntryPersistenceState(initialEntryPersistenceState)
		overallLoadedKeyRef.current =
			initialOverall != null ? `${entryId}:${initialEventId}` : null
	}, [
		entryId,
		initialEventId,
		initialEntryLookupStatus,
		initialEntryPersistenceState,
		initialOverall
	])

	const retryEntryLookup = useCallback(() => {
		overallLoadedKeyRef.current = null
		setEntryLookupReloadRevision(revision => revision + 1)
	}, [])

	useEffect(() => {
		const selectedGw = livePoints.selectedGameweek ?? livePoints.currentGameweek
		if (entryId <= 0 || selectedGw !== livePoints.currentGameweek) {
			setOverall(undefined)
			setEntryLookupStatus(undefined)
			setEntryPersistenceState(undefined)
			overallLoadedKeyRef.current = null
			return
		}
		const overallKey = `${entryId}:${livePoints.currentGameweek}`
		if (overallLoadedKeyRef.current === overallKey) return
		overallLoadedKeyRef.current = overallKey

		let cancelled = false
		void executeQuery<EntrySummaryResponse>(
			GET_ENTRY,
			{ id: entryId },
			{ cache: 'no-store' }
		)
			.then(response => {
				if (cancelled) return
				setEntryLookupStatus(response.entryLookup.status)
				setEntryPersistenceState(response.entryLookup.persistenceState)
				if (
					response.entryLookup.status !== 'FOUND' ||
					!response.entryLookup.entry
				) {
					setOverall(undefined)
					return
				}
				const entry = response.entryLookup.entry
				setOverall({
					overallPoints: entry.overallPoints,
					overallRank: entry.overallRank,
					teamValue: entry.teamValue,
					bank: entry.bank,
					totalTransfers: entry.totalTransfers
				})
			})
			.catch(error => {
				if (!cancelled) overallLoadedKeyRef.current = null
				if (!cancelled) setEntryLookupStatus('UNAVAILABLE')
				if (!cancelled) setEntryPersistenceState(undefined)
				console.warn('[live points] overall snapshot fetch failed:', error)
			})

		return () => {
			cancelled = true
		}
	}, [
		entryId,
		livePoints.currentGameweek,
		livePoints.selectedGameweek,
		entryLookupReloadRevision
	])

	const hasCompetitionContext = Boolean(tournamentId) && from !== 'home'
	const backParams = new URLSearchParams()
	if (tournamentId) backParams.set('tournamentId', tournamentId)
	if (livePoints.selectedGameweek) {
		backParams.set('gw', String(livePoints.selectedGameweek))
	}
	const backQuery = backParams.toString()
	const backHref = hasCompetitionContext
		? `/live/competitions${backQuery ? `?${backQuery}` : ''}`
		: '/'

	let content
	if (livePoints.isLoading && !livePoints.liveData) {
		content = (
			<LivePointsLoading
				activeEntryId={entryId}
				currentGameweek={livePoints.currentGameweek}
				selectedGameweek={livePoints.selectedGameweek}
			/>
		)
	} else {
		content = (
			<LivePointsDashboard
				currentGameweek={livePoints.currentGameweek}
				selectedGameweek={livePoints.selectedGameweek}
				isLoading={livePoints.isLoading}
				isRefreshing={livePoints.isRefreshing}
				error={livePoints.error}
				entryLookupStatus={entryLookupStatus}
				entryPersistenceState={entryPersistenceState}
				isPageActive={livePoints.isPageActive}
				shouldAutoRefresh={livePoints.shouldAutoRefresh}
				liveData={livePoints.liveData}
				overall={overall}
				startingPlayers={livePoints.startingPlayers}
				benchPlayers={livePoints.benchPlayers}
				onGameweekChange={livePoints.changeGameweek}
				onAutoRefresh={livePoints.autoRefresh}
				onRefresh={livePoints.refresh}
				onEntryLookupRetry={retryEntryLookup}
				nextRefreshAt={
					livePoints.snapshot?.nextRefreshAt ??
					livePoints.liveData?.score?.nextRefreshAt ??
					null
				}
			/>
		)
	}

	return (
		<PageShell>
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<Button
					variant="ghost"
					className="-ml-3 mb-2"
					asChild
				>
					<Link href={backHref}>
						<ArrowLeft aria-hidden="true" />{' '}
						{hasCompetitionContext ? t('backTournament') : t('backHome')}
					</Link>
				</Button>
				<StatsPageHeader title={t('title')} />
				{content}
			</div>
		</PageShell>
	)
}
