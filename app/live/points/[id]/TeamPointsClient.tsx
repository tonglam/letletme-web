'use client'

import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { Button } from '@/components/ui/button'
import type { EntryOverallSnapshot } from '@/lib/graphql/operations/entries'
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
import { useEffect, useRef, useState } from 'react'
import { LivePointsDashboard } from '../_components/LivePointsDashboard'
import { LivePointsLoading } from '../_components/LivePointsLoading'
import { useLivePoints } from '../_hooks/useLivePoints'

interface TeamPointsClientProps {
	entryId: number
	tournamentId?: string
	initialEventId: number
	initialSelectedGameweek?: number
	initialLiveData?: LiveCalcData
	initialSnapshot?: LiveSnapshotStatus | null
	initialOverall?: EntryOverallSnapshot
}

export default function TeamPointsClient({
	entryId,
	tournamentId,
	initialEventId,
	initialSelectedGameweek,
	initialLiveData,
	initialSnapshot,
	initialOverall
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
	const overallLoadedKeyRef = useRef<string | null>(
		initialOverall != null ? `${entryId}:${initialEventId}` : null
	)

	useEffect(() => {
		setOverall(initialOverall)
		overallLoadedKeyRef.current =
			initialOverall != null ? `${entryId}:${initialEventId}` : null
	}, [entryId, initialEventId, initialOverall])

	useEffect(() => {
		const selectedGw = livePoints.selectedGameweek ?? livePoints.currentGameweek
		if (entryId <= 0 || selectedGw !== livePoints.currentGameweek) {
			setOverall(undefined)
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
				if (cancelled || !response.entry) return
				setOverall({
					overallPoints: response.entry.overallPoints,
					overallRank: response.entry.overallRank,
					teamValue: response.entry.teamValue,
					bank: response.entry.bank,
					totalTransfers: response.entry.totalTransfers
				})
			})
			.catch(error => {
				if (!cancelled) overallLoadedKeyRef.current = null
				console.warn('[live points] overall snapshot fetch failed:', error)
			})

		return () => {
			cancelled = true
		}
	}, [entryId, livePoints.currentGameweek, livePoints.selectedGameweek])

	const backQuery = livePoints.selectedGameweek
		? `?gw=${livePoints.selectedGameweek}`
		: ''
	const backHref = tournamentId
		? `/live/competitions/${tournamentId}${backQuery}`
		: '/live/competitions'

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
				<Button
					variant="ghost"
					className="-ml-3 mb-2"
					asChild
				>
					<Link href={backHref}>
						<ArrowLeft aria-hidden="true" /> {t('backTournament')}
					</Link>
				</Button>
				<StatsPageHeader title={t('title')} />
				{content}
			</div>
		</PageShell>
	)
}
