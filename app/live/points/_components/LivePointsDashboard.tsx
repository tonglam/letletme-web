'use client'

import { GameweekSelector } from '@/components/data/GameweekSelector'
import { PlayerList } from '@/components/live/PlayerList'
import { TeamStats, type LiveTeamOverall } from '@/components/live/TeamStats'
import { ShareTextFallback } from '@/components/share/ShareTextFallback'
import { SquadPitch } from '@/components/squad-pitch/SquadPitch'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { APP_URL } from '@/i18n/config'
import { localizePathname, type AppLocale } from '@/i18n/routing'
import type { LiveCalcData } from '@/lib/graphql/operations/live'
import { cn } from '@/lib/utils'
import type { Player } from '@/types/player'
import { Check, Copy, ImageIcon, Loader2, RefreshCw } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { deriveLiveTeamStats } from '../_lib/live-points-model'
import { mapPlayersToSquadPitch } from '../_lib/live-points-squad-pitch'
import {
	copyTextToClipboard,
	formatLivePointsShareText
} from '../_lib/live-points-share'
import { LivePointsAutoRefreshCountdown } from './LivePointsAutoRefreshCountdown'

export function LivePointsDashboard({
	entrySearch,
	currentGameweek,
	selectedGameweek,
	isLoading,
	isRefreshing,
	error,
	isPageActive,
	shouldAutoRefresh,
	isMock = false,
	liveData,
	overall,
	startingPlayers,
	benchPlayers,
	onGameweekChange,
	onAutoRefresh,
	onRefresh
}: {
	entrySearch?: ReactNode
	currentGameweek: number
	selectedGameweek?: number
	isLoading: boolean
	isRefreshing: boolean
	error?: string
	isPageActive: boolean
	shouldAutoRefresh: boolean
	isMock?: boolean
	liveData?: LiveCalcData
	overall?: LiveTeamOverall
	startingPlayers: Player[]
	benchPlayers: Player[]
	onGameweekChange: (gameweek: number) => void
	onAutoRefresh: () => Promise<void>
	onRefresh: () => Promise<void>
}) {
	const t = useTranslations('LivePoints')
	const locale = useLocale() as AppLocale
	const autoRefreshEnabled = shouldAutoRefresh && isPageActive
	const squadPitchPlayers = mapPlayersToSquadPitch(startingPlayers)
	const [copied, setCopied] = useState(false)
	const [manualShareText, setManualShareText] = useState<string | null>(null)

	const handleCopyShare = useCallback(async () => {
		if (!liveData) return
		const gameweek = selectedGameweek ?? liveData.event ?? currentGameweek
		const entryId = liveData.entry
		// Prefer browser origin so local/dev shares still open; fall back to prod base.
		const origin =
			typeof window !== 'undefined' ? window.location.origin : APP_URL.origin
		const shareUrl = new URL(
			localizePathname(`/live/points/${entryId}`, locale),
			origin
		).toString()

		const text = formatLivePointsShareText({
			gameweek,
			liveData,
			startingPlayers,
			benchPlayers,
			labels: {
				live: t('shareLive'),
				net: t('shareNet'),
				season: t('shareSeason'),
				chip: t('shareChip'),
				noChip: t('shareNoChip'),
				captain: t('shareCaptain'),
				startingXi: t('startingEleven'),
				bench: t('substitutes'),
				statusPlaying: t('statusPlaying'),
				statusFinished: t('statusFinished'),
				statusNotStarted: t('statusNotStarted'),
				pts: t('pointsAbbreviation'),
				hits: t('shareHits'),
				// Pass {url} into next-intl — bare t('shareFooter') throws FORMATTING_ERROR
				footer: t('shareFooter', { url: shareUrl })
			}
		})
		const copyResult = await copyTextToClipboard(text)
		if (copyResult === 'copied') {
			setManualShareText(null)
			setCopied(true)
			toast.success(t('shareCopied'))
			window.setTimeout(() => setCopied(false), 2000)
		} else if (copyResult === 'unsupported' || copyResult === 'failed') {
			setManualShareText(text)
			toast.warning(
				copyResult === 'unsupported'
					? t('shareCopyUnsupported')
					: t('shareCopyFailed')
			)
		}
	}, [
		benchPlayers,
		currentGameweek,
		liveData,
		locale,
		selectedGameweek,
		startingPlayers,
		t
	])

	return (
		<>
			<div className="mb-6">
				{entrySearch ? <Card className="mb-4 p-4">{entrySearch}</Card> : null}
				<GameweekSelector
					onGameweekChange={onGameweekChange}
					currentGameweek={currentGameweek}
					selectedGameweek={selectedGameweek}
					disabled={isLoading || isRefreshing || isMock}
				/>
				<div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-xs text-muted-foreground">
						{autoRefreshEnabled
							? t('autoActive')
							: shouldAutoRefresh
								? t('autoHidden')
								: t('autoPast')}
					</p>
					<div className="flex flex-wrap items-center gap-2 sm:gap-3">
						<LivePointsAutoRefreshCountdown
							enabled={autoRefreshEnabled}
							onRefresh={onAutoRefresh}
						/>
						<Button
							size="sm"
							variant="outline"
							onClick={() => void handleCopyShare()}
							disabled={!liveData || isLoading}
							aria-label={t('shareCopy')}
						>
							{copied ? (
								<Check
									data-icon="inline-start"
									className="text-primary-ink"
								/>
							) : (
								<Copy data-icon="inline-start" />
							)}
							{copied ? t('shareCopiedShort') : t('shareCopy')}
						</Button>
						{/* TODO: design + implement share-as-image export */}
						<Button
							size="sm"
							variant="outline"
							onClick={() => toast.message(t('shareImageComingSoon'))}
							disabled={!liveData || isLoading}
							aria-label={t('shareCopyImage')}
						>
							<ImageIcon data-icon="inline-start" />
							{t('shareCopyImage')}
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => void onRefresh()}
							disabled={
								isLoading || isRefreshing || selectedGameweek === undefined
							}
						>
							<RefreshCw
								data-icon="inline-start"
								className={isRefreshing ? 'animate-spin' : undefined}
							/>
							{t('refresh')}
						</Button>
					</div>
				</div>
			</div>
			{manualShareText ? (
				<ShareTextFallback
					text={manualShareText}
					message={t('shareCopyUnsupported')}
					fieldLabel={t('shareCopyManualLabel')}
					closeLabel={t('shareCopyClose')}
					onClose={() => setManualShareText(null)}
				/>
			) : null}

			<div
				aria-live="polite"
				className="min-h-5"
			>
				{isRefreshing ? (
					<div className="mb-3 flex items-center justify-end gap-2 text-sm text-muted-foreground">
						<Loader2
							className="size-4 animate-spin text-primary-ink"
							aria-hidden="true"
						/>
						<span>{t('updating')}</span>
					</div>
				) : null}
				{!isRefreshing && error ? (
					<p
						className="mb-3 text-sm text-destructive"
						role="alert"
					>
						{error}
					</p>
				) : !isRefreshing && !liveData ? (
					<p
						className="mb-3 text-sm text-muted-foreground"
						role="status"
					>
						{t('noData')}
					</p>
				) : null}
			</div>

			{liveData ? (
				<>
					<div className={cn(isRefreshing && 'opacity-75 transition-opacity')}>
						<TeamStats
							overall={overall}
							stats={deriveLiveTeamStats(liveData)}
						/>
					</div>

					<div className="mb-8">
						<SquadPitch
							players={squadPitchPlayers}
							title={liveData.entryName ?? `Entry ${liveData.entry}`}
							eyebrow={
								isMock
									? `Mock live lineup · GW ${selectedGameweek ?? liveData.event}`
									: `${t('livePoints')} · GW ${selectedGameweek ?? liveData.event}`
							}
							className={cn(
								'mx-auto max-w-3xl',
								isRefreshing && 'opacity-75 transition-opacity'
							)}
						/>
					</div>

					<section aria-labelledby="live-squad-heading">
						<div className="mb-3">
							<p className="chyron">{t('livePoints')}</p>
							<h2
								id="live-squad-heading"
								className="mt-1 font-display text-xl font-bold tracking-tight sm:text-2xl"
							>
								{t('squad')}
							</h2>
							<p className="mt-1.5 text-xs text-muted-foreground">
								{t('ptsIncludeBonusHint')}
							</p>
						</div>
						<Card
							className={cn(
								'overflow-hidden border-border/80 shadow-sm',
								isRefreshing && 'opacity-75 transition-opacity'
							)}
						>
							<PlayerList
								startingPlayers={startingPlayers}
								benchPlayers={benchPlayers}
							/>
						</Card>
					</section>
				</>
			) : null}
		</>
	)
}
