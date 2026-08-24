import { GameweekBadge } from '@/components/stats/GameweekBadge'
import { Card } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'
import type { HomeGameweek } from '@/lib/graphql/operations/home'
import { formatCompactNumber } from '@/lib/utils'
import { ArrowRight, ArrowRightCircle, Crown, Trophy, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'

type HomeGameweekOverview = NonNullable<
	HomeGameweek['gameweekDesk']['overview']
>

interface StatsSectionProps {
	currentEventId: number | null
	overview: HomeGameweekOverview | null
}

const tileIconStyles = [
	'bg-plum text-electric',
	'bg-electric text-plum',
	'bg-pink text-fascia-foreground',
	'bg-secondary text-foreground'
] as const

export function StatsSection({ currentEventId, overview }: StatsSectionProps) {
	const t = useTranslations('Home')
	const header = (
		<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<p className="eyebrow">{t('thisGameweek')}</p>
				<h2 className="mt-1 flex items-center gap-2.5 font-display text-xl font-bold uppercase tracking-wide">
					<GameweekBadge
						gameweek={currentEventId}
						size="sm"
						fontFamily="display"
					/>
					<span>{t('gameweekStats')}</span>
				</h2>
			</div>
			<Link
				href="/explore/gameweek"
				prefetch={false}
				className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-primary-ink underline-offset-4 hover:underline"
			>
				{t('viewGameweekStats')}
				<ArrowRight
					aria-hidden="true"
					className="size-4"
				/>
			</Link>
		</div>
	)

	if (!overview || !currentEventId) {
		return (
			<Card className="p-4 sm:p-6 lg:p-8">
				{header}
				<div className="py-12 text-center text-muted-foreground">
					<p className="text-sm">{t('noStats')}</p>
				</div>
			</Card>
		)
	}

	const chipLabels: Record<string, string> = {
		bboost: t('benchBoost'),
		'3xc': t('tripleCaptain'),
		wildcard: t('wildcard'),
		freehit: t('freeHit')
	}
	const stats = [
		{
			label: t('highestScore'),
			value: overview.highestPoints?.toString() ?? '0',
			href: overview.highestScoringEntry
				? `/live/points/${overview.highestScoringEntry}`
				: null,
			icon: (
				<Trophy
					aria-hidden="true"
					className="size-5"
				/>
			)
		},
		{
			label: t('topScorer'),
			value: overview.topScorer
				? `${overview.topScorer.webName} (${overview.topScorer.points})`
				: 'N/A',
			href: null,
			icon: (
				<Zap
					aria-hidden="true"
					className="size-5"
				/>
			)
		},
		{
			label: t('mostSelectedCaptain'),
			value: overview.mostCaptained?.webName ?? 'N/A',
			href: null,
			icon: (
				<Crown
					aria-hidden="true"
					className="size-5"
				/>
			)
		},
		{
			label: t('topChipPlayed'),
			value: overview.mostPlayedChip
				? `${chipLabels[overview.mostPlayedChip.name] ?? overview.mostPlayedChip.name} (${formatCompactNumber(overview.mostPlayedChip.numberPlayed)})`
				: t('unknownChip'),
			href: null,
			icon: (
				<ArrowRightCircle
					aria-hidden="true"
					className="size-5"
				/>
			)
		}
	] as const

	return (
		<Card className="p-4 sm:p-6 lg:p-8">
			{header}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{stats.map((stat, index) => {
					const tile = (
						<>
							<div
								className={`mb-3 inline-flex rounded-md p-2.5 ${tileIconStyles[index % tileIconStyles.length]}`}
							>
								{stat.icon}
							</div>
							<div className="space-y-1">
								<p className="eyebrow">{stat.label}</p>
								<p className="whitespace-normal break-words font-display text-2xl font-bold text-foreground">
									{stat.value}
								</p>
							</div>
						</>
					)
					const tileClassName =
						'block rounded-lg border bg-background p-4 transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-electric/50 hover:shadow-sticker-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

					return stat.href ? (
						<Link
							key={stat.label}
							href={stat.href}
							className={tileClassName}
							aria-label={`${stat.label}: ${stat.value}`}
						>
							{tile}
						</Link>
					) : (
						<div
							key={stat.label}
							className={tileClassName}
						>
							{tile}
						</div>
					)
				})}
			</div>
		</Card>
	)
}
