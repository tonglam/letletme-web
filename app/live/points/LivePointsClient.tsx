'use client'

import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { Card } from '@/components/ui/card'
import {
	GET_ENTRY,
	type EntryOverallSnapshot,
	type EntryLookupStatus,
	type EntrySummaryResponse
} from '@/lib/graphql/operations/entries'
import { executeQuery } from '@/lib/graphql-client'
import type {
	LiveCalcData,
	LiveSnapshotStatus
} from '@/lib/graphql/operations/live'
import { EntrySearchForm } from './_components/EntrySearchForm'
import { LivePointsDashboard } from './_components/LivePointsDashboard'
import { LivePointsLoading } from './_components/LivePointsLoading'
import { useLivePoints } from './_hooks/useLivePoints'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

interface LivePointsClientProps {
	initialEntryId: number
	initialEventId: number
	initialLiveData?: LiveCalcData
	initialSnapshot?: LiveSnapshotStatus | null
	initialOverall?: EntryOverallSnapshot
	initialEntryLookupStatus?: EntryLookupStatus
}

export default function LivePointsClient({
	initialEntryId,
	initialEventId,
	initialLiveData,
	initialSnapshot,
	initialOverall,
	initialEntryLookupStatus
}: LivePointsClientProps) {
	const t = useTranslations('LivePoints')
	const livePoints = useLivePoints({
		initialEntryId,
		initialEventId,
		initialLiveData,
		initialSnapshot
	})
	const [overall, setOverall] = useState(initialOverall)
	const [entryLookupStatus, setEntryLookupStatus] = useState<
		EntryLookupStatus | undefined
	>(initialEntryLookupStatus)
	const overallLoadedKeyRef = useRef<string | null>(
		initialOverall != null ? `${initialEntryId}:${initialEventId}` : null
	)

	useEffect(() => {
		setOverall(initialOverall)
		setEntryLookupStatus(initialEntryLookupStatus)
		overallLoadedKeyRef.current =
			initialOverall != null ? `${initialEntryId}:${initialEventId}` : null
	}, [initialEntryId, initialEventId, initialEntryLookupStatus, initialOverall])

	useEffect(() => {
		const selectedGw = livePoints.selectedGameweek ?? livePoints.currentGameweek
		if (
			livePoints.activeEntryId <= 0 ||
			selectedGw !== livePoints.currentGameweek
		) {
			setOverall(undefined)
			overallLoadedKeyRef.current = null
			return
		}
		const overallKey = `${livePoints.activeEntryId}:${livePoints.currentGameweek}`
		if (overallLoadedKeyRef.current === overallKey) return
		overallLoadedKeyRef.current = overallKey

		let cancelled = false
		void executeQuery<EntrySummaryResponse>(
			GET_ENTRY,
			{ id: livePoints.activeEntryId },
			{ cache: 'no-store' }
		)
			.then(response => {
				if (cancelled) return
				setEntryLookupStatus(response.entryLookup.status)
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
				console.warn('[live points] overall snapshot fetch failed:', error)
			})

		return () => {
			cancelled = true
		}
	}, [
		livePoints.activeEntryId,
		livePoints.currentGameweek,
		livePoints.selectedGameweek
	])
	const entrySearch = (
		<EntrySearchForm
			value={livePoints.entryIdInput}
			onChange={livePoints.setEntryIdInput}
			onSubmit={livePoints.submitEntry}
		/>
	)

	let content
	if (!livePoints.activeEntryId && !livePoints.isLoading) {
		content = (
			<Card className="p-6 sm:p-8">
				<p className="mb-4 text-muted-foreground">{t('enterEntry')}</p>
				{entrySearch}
				{livePoints.error ? (
					<p
						className="mt-3 text-sm text-destructive"
						role="alert"
					>
						{livePoints.error}
					</p>
				) : null}
			</Card>
		)
	} else if (livePoints.isLoading && !livePoints.liveData) {
		content = (
			<LivePointsLoading
				entrySearch={entrySearch}
				activeEntryId={livePoints.activeEntryId}
				currentGameweek={livePoints.currentGameweek}
				selectedGameweek={livePoints.selectedGameweek}
			/>
		)
	} else {
		content = (
			<LivePointsDashboard
				entrySearch={entrySearch}
				currentGameweek={livePoints.currentGameweek}
				selectedGameweek={livePoints.selectedGameweek}
				isLoading={livePoints.isLoading}
				isRefreshing={livePoints.isRefreshing}
				error={livePoints.error}
				entryLookupStatus={entryLookupStatus}
				isPageActive={livePoints.isPageActive}
				shouldAutoRefresh={livePoints.shouldAutoRefresh}
				liveData={livePoints.liveData}
				overall={overall}
				startingPlayers={livePoints.startingPlayers}
				benchPlayers={livePoints.benchPlayers}
				onGameweekChange={livePoints.changeGameweek}
				onAutoRefresh={livePoints.autoRefresh}
				onRefresh={livePoints.refresh}
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
				<StatsPageHeader title={t('title')} />
				{content}
			</div>
		</PageShell>
	)
}
