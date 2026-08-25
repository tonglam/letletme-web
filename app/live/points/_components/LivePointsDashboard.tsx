'use client'

import { GameweekSelector } from '@/components/data/GameweekSelector'
import { PlayerList } from '@/components/live/PlayerList'
import { PlayerDetailModal } from '@/components/live/PlayerDetailModal'
import { buildLivePlayerDetail } from '@/components/live/player-detail-model'
import { TeamStats } from '@/components/live/TeamStats'
import { ShareActions } from '@/components/share/ShareActions'
import { SquadPitch } from '@/components/squad-pitch/SquadPitch'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { APP_URL } from '@/i18n/config'
import { localizePathname, type AppLocale } from '@/i18n/routing'
import type { EntryOverallSnapshot } from '@/lib/graphql/operations/entries'
import type { LiveCalcData } from '@/lib/graphql/operations/live'
import { cn } from '@/lib/utils'
import type { Player } from '@/types/player'
import type { PlayerDetail } from '@/types/player-detail'
import { Loader2, RefreshCw } from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import type { NumberFormatOptions } from 'use-intl'
import { deriveLiveTeamStats } from '../_lib/live-points-model'
import { mapPlayersToSquadPitch } from '../_lib/live-points-squad-pitch'
import { formatLivePointsShareText } from '../_lib/live-points-share'
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
	liveData,
	overall,
	startingPlayers,
	benchPlayers,
	onGameweekChange,
	onAutoRefresh,
	onRefresh,
	nextRefreshAt
}: {
	entrySearch?: ReactNode
	currentGameweek: number
	selectedGameweek?: number
	isLoading: boolean
	isRefreshing: boolean
	error?: string
	isPageActive: boolean
	shouldAutoRefresh: boolean
	liveData?: LiveCalcData
	overall?: EntryOverallSnapshot
	startingPlayers: Player[]
	benchPlayers: Player[]
	onGameweekChange: (gameweek: number) => void
	onAutoRefresh: () => Promise<void>
	onRefresh: () => Promise<void>
	nextRefreshAt?: string | null
}) {
	const t = useTranslations('LivePoints')
	const format = useFormatter()
	const locale = useLocale() as AppLocale
	const autoRefreshEnabled = shouldAutoRefresh && isPageActive
	const squadPitchPlayers = mapPlayersToSquadPitch(startingPlayers)
	const squadPitchBenchPlayers = mapPlayersToSquadPitch(benchPlayers)
	const formatOverallPoints = (
		value: number | null,
		options?: NumberFormatOptions
	) => (value == null ? '—' : format.number(value, options))
	const formatOverallRank = (
		value: number | null,
		options?: NumberFormatOptions
	) => (value == null || value <= 0 ? '—' : format.number(value, options))
	const formatPitchChip = (chip: string | null | undefined) => {
		const normalized = chip?.toLowerCase() ?? ''
		if (!normalized) return t('noActiveChips')
		if (
			normalized.includes('bench') ||
			normalized === 'bb' ||
			normalized === 'bboost'
		) {
			return t('pitchBenchBoost')
		}
		if (
			normalized.includes('3x') ||
			normalized.includes('triple') ||
			normalized === 'tc'
		) {
			return t('pitchTripleCaptain')
		}
		if (normalized.includes('wildcard') || normalized === 'wc') {
			return t('pitchWildcard')
		}
		if (
			normalized.includes('free') ||
			normalized === 'fh' ||
			normalized === 'free_hit'
		) {
			return t('pitchFreeHit')
		}
		return chip ?? t('noActiveChips')
	}
	const benchBoostActive = (() => {
		const normalized = liveData?.chip?.toLowerCase() ?? ''
		return (
			normalized.includes('bench') ||
			normalized === 'bb' ||
			normalized === 'bboost'
		)
	})()
	const gameweek = selectedGameweek ?? liveData?.event ?? currentGameweek
	const officialEventPoints = liveData?.score?.eventPoints ?? null
	const officialTotalPoints =
		liveData?.score?.totalScope === 'OVERALL'
			? liveData.score.totalPoints
			: null
	const scoreStatus = (() => {
		const score = liveData?.score
		if (!score || score.state === 'UNAVAILABLE') return t('scoreUnavailable')
		if (score.state === 'SETTLING') return t('scoreSettling')
		if (
			String(score.source) === 'LOCAL_MULTIPLIER_FALLBACK' ||
			String(score.state) === 'FALLBACK'
		) {
			return t('scoreFallback')
		}
		if (score.state === 'STALE') return t('scoreDelayed')
		return t('scoreOfficial')
	})()
	const squadTitle = liveData?.entryName ?? `Entry ${liveData?.entry ?? ''}`
	const squadPitchLabels = {
		formation: t('squadFormation', { title: squadTitle }),
		positions: {
			GKP: t('squadGoalkeeper'),
			DEF: t('squadDefenders'),
			MID: t('squadMidfielders'),
			FWD: t('squadForwards')
		},
		captain: t('captain'),
		viceCaptain: t('viceCaptain'),
		total: t('pitchTotalPoints'),
		playerDetails: (player: { webName: string }) =>
			t('viewPlayer', { player: player.webName })
	}
	const showLiveOverallRank = overall != null && gameweek === currentGameweek
	const officialOverallRank =
		liveData?.score?.overallRank ?? overall?.overallRank ?? null
	const pitchHeaderStats = liveData
		? {
				eyebrow: showLiveOverallRank
					? `${t('pitchTotalPoints')} ${formatOverallPoints(officialTotalPoints)} · ${t('pitchOverallRank')} ${formatOverallRank(officialOverallRank, { notation: 'compact' })}`
					: `${t('pitchTotalPoints')} ${formatOverallPoints(officialTotalPoints)}`,
				details: [
					{
						label: t('pitchGameweekPoints'),
						value: formatOverallPoints(officialEventPoints),
						accent: true
					},
					{
						label: t('pitchChip'),
						value: formatPitchChip(liveData.chip)
					}
				]
			}
		: undefined
	const [selectedPitchPlayer, setSelectedPitchPlayer] =
		useState<PlayerDetail | null>(null)
	const squadPitchRef = useRef<HTMLElement | null>(null)

	const handlePitchPlayerClick = useCallback(
		(playerId: string) => {
			const player = [...startingPlayers, ...benchPlayers].find(
				candidate => candidate.id === playerId
			)
			if (player) setSelectedPitchPlayer(buildLivePlayerDetail(player))
		},
		[benchPlayers, startingPlayers]
	)

	const shareText = useCallback(() => {
		if (!liveData) return ''
		const gameweek = selectedGameweek ?? liveData.event ?? currentGameweek
		const entryId = liveData.entry
		// Prefer browser origin so local/dev shares still open; fall back to prod base.
		const origin =
			typeof window !== 'undefined' ? window.location.origin : APP_URL.origin
		const shareUrl = new URL(
			localizePathname(`/live/points/${entryId}`, locale),
			origin
		)
		shareUrl.searchParams.set('gw', String(gameweek))

		return formatLivePointsShareText({
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
				footer: t('shareFooter', { url: shareUrl.toString() })
			}
		})
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
					disabled={isLoading || isRefreshing}
				/>
				<div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-xs text-muted-foreground">
						{autoRefreshEnabled
							? t('autoActive')
							: shouldAutoRefresh
								? t('autoHidden')
								: t('autoPast')}
					</p>
					{liveData ? (
						<p
							className="text-xs text-muted-foreground"
							role="status"
						>
							{scoreStatus}
							{liveData.score?.reconciliation === 'SOURCE_SKEW'
								? ` · ${t('scoreDetailsSyncing')}`
								: ''}
						</p>
					) : null}
					<div className="flex flex-wrap items-center gap-2 sm:gap-3">
						<LivePointsAutoRefreshCountdown
							enabled={autoRefreshEnabled}
							onRefresh={onAutoRefresh}
							nextRefreshAt={nextRefreshAt}
						/>
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
						<TeamStats stats={deriveLiveTeamStats(liveData)} />
					</div>

					<div className="mb-3 flex justify-end">
						<ShareActions
							actions={['image']}
							text={shareText}
							imageRef={squadPitchRef}
							title={liveData.entryName ?? t('teamTitle')}
							disabled={!liveData || isLoading}
						/>
					</div>

					<div className="mb-8">
						<SquadPitch
							ref={squadPitchRef}
							onPlayerClick={handlePitchPlayerClick}
							players={squadPitchPlayers}
							benchPlayers={squadPitchBenchPlayers}
							benchTitle={t('substitutes')}
							benchBoost={benchBoostActive}
							benchBoostLabel={t('pitchBenchBoost')}
							benchPointsLabel={t('pointsAbbreviation')}
							title={squadTitle}
							labels={squadPitchLabels}
							managerName={liveData.playerName ?? undefined}
							headerStats={pitchHeaderStats}
							eyebrow={`${t('livePoints')} · GW ${selectedGameweek ?? liveData.event}`}
							className={cn(
								'mx-auto max-w-3xl',
								isRefreshing && 'opacity-75 transition-opacity'
							)}
						/>
					</div>

					<PlayerDetailModal
						player={selectedPitchPlayer}
						isOpen={selectedPitchPlayer !== null}
						onClose={() => setSelectedPitchPlayer(null)}
					/>

					<section aria-labelledby="live-squad-heading">
						<div className="mb-3 flex items-start justify-between gap-4">
							<div>
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
							<ShareActions
								actions={['text']}
								text={shareText}
								title={liveData.entryName ?? t('teamTitle')}
								className="shrink-0"
								disabled={!liveData || isLoading}
							/>
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
