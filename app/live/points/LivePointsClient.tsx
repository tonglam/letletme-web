'use client'

import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { Card } from '@/components/ui/card'
import {
	type EntryOverallSnapshot,
	type EntryLookupStatus,
	type EntryPersistenceState
} from '@/lib/graphql/operations/entries'
import type {
	LiveCalcData,
	LiveSnapshotStatus
} from '@/lib/graphql/operations/live'
import { EntrySearchForm } from './_components/EntrySearchForm'
import { LivePointsDashboard } from './_components/LivePointsDashboard'
import { LivePointsLoading } from './_components/LivePointsLoading'
import { useLivePoints } from './_hooks/useLivePoints'
import { useEntryOverall } from './_hooks/useEntryOverall'
import { useTranslations } from 'next-intl'

interface LivePointsClientProps {
	initialEntryId: number
	initialEventId: number
	initialLiveData?: LiveCalcData
	initialSnapshot?: LiveSnapshotStatus | null
	initialOverall?: EntryOverallSnapshot
	initialEntryLookupStatus?: EntryLookupStatus
	initialEntryPersistenceState?: EntryPersistenceState | null
}

export default function LivePointsClient({
	initialEntryId,
	initialEventId,
	initialLiveData,
	initialSnapshot,
	initialOverall,
	initialEntryLookupStatus,
	initialEntryPersistenceState
}: LivePointsClientProps) {
	const t = useTranslations('LivePoints')
	const livePoints = useLivePoints({
		initialEntryId,
		initialEventId,
		initialLiveData,
		initialSnapshot
	})
	const {
		overall,
		entryLookupStatus,
		entryPersistenceState,
		retryEntryLookup
	} = useEntryOverall({
		entryId: livePoints.activeEntryId,
		currentGameweek: livePoints.currentGameweek,
		selectedGameweek: livePoints.selectedGameweek,
		initialEntryId,
		initialEventId,
		initialOverall,
		initialEntryLookupStatus,
		initialEntryPersistenceState
	})
	const refreshAll = async () => {
		retryEntryLookup()
		await livePoints.refresh()
	}
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
				entryPersistenceState={entryPersistenceState}
				isPageActive={livePoints.isPageActive}
				shouldAutoRefresh={livePoints.shouldAutoRefresh}
				liveData={livePoints.liveData}
				overall={overall}
				startingPlayers={livePoints.startingPlayers}
				benchPlayers={livePoints.benchPlayers}
				onGameweekChange={livePoints.changeGameweek}
				onAutoRefresh={livePoints.autoRefresh}
				onRefresh={refreshAll}
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
				<StatsPageHeader title={t('title')} />
				{content}
			</div>
		</PageShell>
	)
}
