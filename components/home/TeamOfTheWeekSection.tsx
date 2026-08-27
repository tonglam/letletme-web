'use client'

import {
	SquadPitch,
	type SquadPitchPlayer
} from '@/components/squad-pitch/SquadPitch'
import { PlayerDetailModal } from '@/components/live/PlayerDetailModal'
import { useMatchPlayerDetail } from '@/components/live/match-card/useMatchPlayerDetail'
import { GameweekBadge } from '@/components/stats/GameweekBadge'
import { ShareActions } from '@/components/share/ShareActions'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { HomeGameweekPlayer } from '@/lib/graphql/operations/home'
import { resolveSquadTeamCode } from '@/lib/squad-pitch-team-codes'
import type { PlayerStat } from '@/types/match'
import { useTranslations } from 'next-intl'
import { useCallback, useRef } from 'react'

const HOME_POSITION_MAP: Record<
	HomeGameweekPlayer['position'],
	SquadPitchPlayer['position']
> = {
	GOALKEEPER: 'GKP',
	DEFENDER: 'DEF',
	MIDFIELDER: 'MID',
	FORWARD: 'FWD'
}

function mapTeamOfWeekPlayer(player: HomeGameweekPlayer): SquadPitchPlayer {
	const teamBadgeLabel = player.teamShortName?.trim().toUpperCase() || '—'
	const teamCode = resolveSquadTeamCode(player.teamShortName)

	return {
		id: String(player.id),
		webName: player.webName,
		score: player.totalPoints,
		position: HOME_POSITION_MAP[player.position],
		...(teamCode ? { teamCode } : { teamBadgeLabel })
	}
}

interface TeamOfTheWeekSectionProps {
	currentEventId: number | null
	dreamTeam?: HomeGameweekPlayer[]
	hasError?: boolean
	showShareActions?: boolean
}

export function TeamOfTheWeekSectionFallback({
	currentEventId
}: Pick<TeamOfTheWeekSectionProps, 'currentEventId'>) {
	return (
		<TeamOfTheWeekCard
			currentEventId={currentEventId}
			teamOfTheWeek={[]}
			isLoading
		/>
	)
}

function TeamOfTheWeekCard({
	currentEventId,
	teamOfTheWeek,
	isLoading = false,
	hasError,
	showShareActions = true
}: {
	currentEventId: number | null
	teamOfTheWeek: HomeGameweekPlayer[]
	isLoading?: boolean
	hasError?: boolean
	showShareActions?: boolean
}) {
	const t = useTranslations('Home')
	const tPitch = useTranslations('LivePoints')
	const shareRef = useRef<HTMLElement | null>(null)
	const {
		closePlayerDetail,
		isLoading: isPlayerDetailLoading,
		isOpen: isPlayerDetailOpen,
		openPlayerDetail,
		selectedPlayer
	} = useMatchPlayerDetail(currentEventId ?? undefined)
	const pitchPlayers = teamOfTheWeek.map(mapTeamOfWeekPlayer)
	const handlePlayerClick = useCallback(
		(playerId: string) => {
			const player = teamOfTheWeek.find(
				candidate => String(candidate.id) === playerId
			)
			if (!player) return
			const playerStat: PlayerStat = {
				player: player.webName,
				element: player.id,
				elementType:
					player.position === 'GOALKEEPER'
						? 1
						: player.position === 'DEFENDER'
							? 2
							: player.position === 'FORWARD'
								? 4
								: 3,
				totalPoints: player.totalPoints
			}
			void openPlayerDetail(
				playerStat,
				player.teamShortName,
				player.teamShortName
			)
		},
		[openPlayerDetail, teamOfTheWeek]
	)
	return (
		<>
			<Card
				aria-labelledby="home-team-of-week-title"
				className="overflow-hidden rounded-none sm:rounded-lg"
			>
				<div className="flex flex-col gap-4 border-b px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6 lg:px-8">
					<h2
						id="home-team-of-week-title"
						className="flex flex-wrap items-center gap-2.5 font-display text-xl font-bold uppercase tracking-wide text-foreground sm:text-2xl"
					>
						<GameweekBadge
							gameweek={currentEventId}
							size="sm"
							fontFamily="display"
						/>
						<span>{t('teamOfWeek')}</span>
					</h2>
					{showShareActions && teamOfTheWeek.length > 0 && !isLoading ? (
						<ShareActions
							actions={['image']}
							text={t('teamOfWeek')}
							imageRef={shareRef}
							title={t('teamOfWeek')}
							className="flex shrink-0 flex-wrap items-center gap-2"
						/>
					) : null}
				</div>

				{hasError ? (
					<div className="border-b border-destructive/20 bg-destructive/10 p-4 sm:p-6">
						<p className="text-sm text-destructive">{t('teamOfWeekFailed')}</p>
					</div>
				) : null}

				{isLoading ? (
					<Skeleton className="m-4 aspect-[1304/1244] rounded-xl sm:m-6" />
				) : teamOfTheWeek.length === 0 ? (
					<p className="px-4 py-12 text-center text-sm text-muted-foreground sm:px-6">
						{t('noTeamOfWeek')}
					</p>
				) : (
					<SquadPitch
						ref={shareRef}
						players={pitchPlayers}
						onPlayerClick={handlePlayerClick}
						labels={{
							formation: tPitch('squadFormation', {
								title: t('teamOfWeek')
							}),
							positions: {
								GKP: tPitch('squadGoalkeeper'),
								DEF: tPitch('squadDefenders'),
								MID: tPitch('squadMidfielders'),
								FWD: tPitch('squadForwards')
							},
							captain: tPitch('captain'),
							viceCaptain: tPitch('viceCaptain'),
							total: tPitch('pitchTotalPoints'),
							playerDetailsTemplate: tPitch('viewPlayer', {
								player: '{player}'
							})
						}}
						showHeader
						title={t('teamOfWeek')}
						eyebrow={
							currentEventId != null
								? `GW${currentEventId}`
								: t('teamOfWeek')
						}
						className="mx-auto max-w-3xl"
					/>
				)}
			</Card>
			<PlayerDetailModal
				player={selectedPlayer}
				isOpen={isPlayerDetailOpen}
				onClose={closePlayerDetail}
				isLoading={isPlayerDetailLoading}
			/>
		</>
	)
}

export function TeamOfTheWeekSection({
	currentEventId,
	dreamTeam = [],
	hasError = false,
	showShareActions = true
}: TeamOfTheWeekSectionProps) {
	return (
		<TeamOfTheWeekCard
			currentEventId={currentEventId}
			teamOfTheWeek={dreamTeam}
			hasError={hasError}
			showShareActions={showShareActions}
		/>
	)
}
