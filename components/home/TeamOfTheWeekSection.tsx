import { GameweekBadge } from '@/components/stats/GameweekBadge'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { HomeGameweekPlayer } from '@/lib/graphql/operations/home'
import { positionBadgeClass } from '@/lib/position-style'
import { normalizePosition } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface TeamOfTheWeekSectionProps {
	currentEventId: number | null
	dreamTeam?: HomeGameweekPlayer[]
	hasError?: boolean
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
	hasError
}: {
	currentEventId: number | null
	teamOfTheWeek: HomeGameweekPlayer[]
	isLoading?: boolean
	hasError?: boolean
}) {
	const t = useTranslations('Home')
	return (
		<Card className="rounded-none p-4 sm:rounded-lg sm:p-6 lg:p-8">
			<div className="mb-6">
				<p className="eyebrow">{t('thisGameweek')}</p>
				<h2 className="mt-1 flex flex-wrap items-center gap-2.5 font-display text-xl font-bold uppercase tracking-wide">
					<GameweekBadge gameweek={currentEventId} size="sm" />
					<span>{t('teamOfWeek')}</span>
					{teamOfTheWeek.length > 0 && !isLoading ? (
						<Badge variant="secondary">
							{t('playerCount', { count: teamOfTheWeek.length })}
						</Badge>
					) : null}
				</h2>
			</div>

			{hasError ? (
				<div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
					<p className="text-sm text-destructive">{t('teamOfWeekFailed')}</p>
				</div>
			) : null}

			{isLoading ? (
				<div className="space-y-2">
					{Array.from({ length: 11 }).map((_, index) => (
						<Skeleton key={index} className="h-14 w-full rounded-lg" />
					))}
				</div>
			) : (
				teamOfTheWeek.length === 0 ? (
					<p className="py-8 text-center text-sm text-muted-foreground">
						{t('noTeamOfWeek')}
					</p>
				) : (
					<ol className="divide-y rounded-lg border surface-inset-soft px-3">
						{teamOfTheWeek.map((player, index) => {
							const position = normalizePosition(player.position)
							return (
								<li
									key={player.id}
									className="grid min-h-12 grid-cols-[2rem_3rem_minmax(0,1fr)_auto] items-center gap-2 py-2"
								>
									<span className="font-mono text-xs tabular-nums text-muted-foreground">
										{index + 1}
									</span>
									<Badge
										variant="secondary"
										className={positionBadgeClass(position)}
									>
										{position}
									</Badge>
									<span className="min-w-0">
										<span className="block truncate text-sm font-semibold">
											{player.webName}
										</span>
										<span className="block text-caption text-muted-foreground">
											{player.teamShortName}
										</span>
									</span>
									<span className="font-mono text-sm font-bold tabular-nums text-primary-ink">
										{player.totalPoints}
									</span>
								</li>
							)
						})}
					</ol>
				)
			)}
		</Card>
	)
}

export function TeamOfTheWeekSection({
	currentEventId,
	dreamTeam = [],
	hasError = false
}: TeamOfTheWeekSectionProps) {
	return (
		<TeamOfTheWeekCard
			currentEventId={currentEventId}
			teamOfTheWeek={dreamTeam}
			hasError={hasError}
		/>
	)
}
