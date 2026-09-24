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
import { ArrowLeft } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { LivePointsDashboard } from '../_components/LivePointsDashboard'
import { LivePointsLoading } from '../_components/LivePointsLoading'
import { useLivePoints } from '../_hooks/useLivePoints'
import { useEntryOverall } from '../_hooks/useEntryOverall'

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
	isOfficialUpdating?: boolean
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
	initialEntryPersistenceState,
	isOfficialUpdating = false
}: TeamPointsClientProps) {
	const t = useTranslations('LivePoints')
	const searchParams = useSearchParams()
	const reconciledGameweekRef = useRef<string | null>(null)
	const livePoints = useLivePoints({
		initialEntryId: entryId,
		initialEventId,
		initialSelectedGameweek,
		initialLiveData,
		initialSnapshot,
		isOfficialUpdating
	})
	const reconcileGameweek = livePoints.changeGameweek
	const currentGameweek = livePoints.currentGameweek
	const isLoading = livePoints.isLoading
	const liveDataEvent = livePoints.liveData?.event
	const selectedGameweek = livePoints.selectedGameweek
	const snapshotEventId = livePoints.snapshot?.eventId
	const {
		overall,
		entryLookupStatus,
		entryPersistenceState,
		retryEntryLookup
	} = useEntryOverall({
		entryId,
		currentGameweek: livePoints.currentGameweek,
		selectedGameweek: livePoints.selectedGameweek,
		initialEntryId: entryId,
		initialEventId,
		initialOverall,
		initialEntryLookupStatus,
		initialEntryPersistenceState
	})
	useEffect(() => {
		const requestedGameweek = Number(searchParams.get('gw'))
		const targetGameweek =
			Number.isInteger(requestedGameweek) &&
			requestedGameweek >= 1 &&
			requestedGameweek <= 38
				? requestedGameweek
				: currentGameweek
		if (!Number.isInteger(targetGameweek) || targetGameweek <= 0) return

		const targetKey = `${entryId}:${targetGameweek}`
		const contentGameweek = liveDataEvent ?? snapshotEventId
		const alreadyAligned =
			selectedGameweek === targetGameweek &&
			(isLoading || contentGameweek === targetGameweek)
		if (alreadyAligned) {
			if (reconciledGameweekRef.current === targetKey)
				reconciledGameweekRef.current = null
			return
		}
		if (reconciledGameweekRef.current === targetKey) return

		reconciledGameweekRef.current = targetKey
		reconcileGameweek(targetGameweek)
	}, [
		currentGameweek,
		entryId,
		isLoading,
		liveDataEvent,
		reconcileGameweek,
		selectedGameweek,
		snapshotEventId,
		searchParams
	])
	const refreshAll = async () => {
		retryEntryLookup()
		await livePoints.refresh()
	}

	const changeGameweek = (gameweek: number) => {
		const nextUrl = new URL(window.location.href)
		nextUrl.searchParams.set('gw', String(gameweek))
		livePoints.changeGameweek(gameweek)
		window.history.replaceState(
			window.history.state,
			'',
			`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
		)
	}

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
				readyRecoveryAttempt={livePoints.readyRecoveryAttempt}
				readyMeasurementEnabled={livePoints.readyMeasurementEnabled}
				activeEntryId={entryId}
				currentGameweek={livePoints.currentGameweek}
				selectedGameweek={livePoints.selectedGameweek}
				isLoading={livePoints.isLoading}
				isRefreshing={livePoints.isRefreshing}
				error={livePoints.error}
				isOfficialUpdating={livePoints.isOfficialUpdating}
				entryLookupStatus={entryLookupStatus}
				entryPersistenceState={entryPersistenceState}
				isPageActive={livePoints.isPageActive}
				shouldAutoRefresh={livePoints.shouldAutoRefresh}
				liveData={livePoints.liveData}
				overall={overall}
				startingPlayers={livePoints.startingPlayers}
				benchPlayers={livePoints.benchPlayers}
				onGameweekChange={changeGameweek}
				onAutoRefresh={livePoints.autoRefresh}
				onRefresh={refreshAll}
				onEntryLookupRetry={retryEntryLookup}
				nextRefreshAt={
					livePoints.snapshot?.nextRefreshAt ??
					livePoints.liveData?.score?.times.nextRefreshAt ??
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
