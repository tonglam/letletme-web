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
	const historyStateRef = useRef({
		currentGameweek: livePoints.currentGameweek,
		isLoading: livePoints.isLoading,
		liveDataEvent: livePoints.liveData?.event,
		selectedGameweek: livePoints.selectedGameweek,
		snapshotEventId: livePoints.snapshot?.eventId
	})
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
		historyStateRef.current = {
			currentGameweek: livePoints.currentGameweek,
			isLoading: livePoints.isLoading,
			liveDataEvent: livePoints.liveData?.event,
			selectedGameweek: livePoints.selectedGameweek,
			snapshotEventId: livePoints.snapshot?.eventId
		}
		const reconciled = reconciledGameweekRef.current
		if (!reconciled) return
		const targetGameweek = Number(reconciled.split(':').at(-1))
		const contentGameweek =
			livePoints.liveData?.event ?? livePoints.snapshot?.eventId
		if (
			livePoints.selectedGameweek === targetGameweek &&
			!livePoints.isLoading &&
			contentGameweek === targetGameweek
		) {
			reconciledGameweekRef.current = null
		}
	}, [
		entryId,
		livePoints.currentGameweek,
		livePoints.isLoading,
		livePoints.liveData?.event,
		livePoints.selectedGameweek,
		livePoints.snapshot?.eventId
	])
	useEffect(() => {
		const handlePopState = () => {
			const requestedGameweek = Number(
				new URL(window.location.href).searchParams.get('gw')
			)
			const { currentGameweek, isLoading, liveDataEvent, selectedGameweek, snapshotEventId } =
				historyStateRef.current
			const targetGameweek =
				Number.isInteger(requestedGameweek) &&
				requestedGameweek >= 1 &&
				requestedGameweek <= 38
					? requestedGameweek
					: currentGameweek
			if (!Number.isInteger(targetGameweek) || targetGameweek <= 0) return

			const contentGameweek = liveDataEvent ?? snapshotEventId
			const alreadyAligned =
				selectedGameweek === targetGameweek &&
				(isLoading || contentGameweek === targetGameweek)
			if (alreadyAligned) return

			const targetKey = `${entryId}:${targetGameweek}`
			if (reconciledGameweekRef.current === targetKey) return
			reconciledGameweekRef.current = targetKey
			reconcileGameweek(targetGameweek)
		}

		window.addEventListener('popstate', handlePopState)
		return () => window.removeEventListener('popstate', handlePopState)
	}, [entryId, reconcileGameweek])
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
