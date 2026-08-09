import { GameweekBadge } from '@/components/stats/GameweekBadge'
import { Card } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'
import type {
	ChipPlay,
	EventOverallResult,
} from '@/lib/graphql/operations/events'
import homeStats from '@/lib/home-stats'
import { formatCompactNumber } from '@/lib/utils'
import { ArrowRight, ArrowRightCircle, Crown, Trophy, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface StatsSectionProps {
	currentEventId: number | null
	overallResult: EventOverallResult | null
}

const tileIconStyles = [
	'bg-plum text-electric',
	'bg-electric text-plum',
	'bg-pink text-white',
	'bg-secondary text-foreground',
] as const

export function StatsSection({ currentEventId, overallResult }: StatsSectionProps) {
	const t = useTranslations('Home')
	if (!overallResult || !currentEventId) {
		return (
			<Card className="p-4 sm:p-6 lg:p-8">
				<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
							{t('thisGameweek')}
						</p>
						<h2 className="mt-1 flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
							<GameweekBadge gameweek={null} size="sm" />
							<span>{t('gameweekStats')}</span>
						</h2>
					</div>
					<Link
						href="/data/gameweek"
						className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-primary-ink underline-offset-4 hover:underline"
					>
						{t('viewGameweekStats')}
						<ArrowRight aria-hidden="true" className="size-4" />
					</Link>
				</div>
				<div className="py-12 text-center text-muted-foreground">
					<p className="text-sm">{t('noStats')}</p>
				</div>
			</Card>
		)
	}

	const mostPlayedChip = (overallResult.chipPlays ?? []).reduce<ChipPlay | null>(
		(max, chip) => (!max || chip.numberPlayed > max.numberPlayed ? chip : max),
		null,
	)
	const chipLabels: Record<string, string> = {
		bboost: t('benchBoost'),
		'3xc': t('tripleCaptain'),
		wildcard: t('wildcard'),
		freehit: t('freeHit'),
	}

	const stats = [
		{
			label: t('highestScore'),
			value: overallResult.highestScore?.toString() ?? '0',
			icon: <Trophy aria-hidden="true" className="size-5" />,
		},
		{
			label: t('topScorer'),
			value: homeStats.formatTopScorerValue(overallResult.topElementInfo),
			icon: <Zap aria-hidden="true" className="size-5" />,
		},
		{
			label: t('mostSelectedCaptain'),
			value: overallResult.mostCaptainedPlayer?.webName ?? 'N/A',
			icon: <Crown aria-hidden="true" className="size-5" />,
		},
		{
			label: t('topChipPlayed'),
			value: mostPlayedChip
				? `${chipLabels[mostPlayedChip.chipName] ?? mostPlayedChip.chipName ?? t('unknownChip')} (${formatCompactNumber(mostPlayedChip.numberPlayed)})`
				: t('unknownChip'),
			icon: <ArrowRightCircle aria-hidden="true" className="size-5" />,
		},
	]

	return (
		<Card className="p-4 sm:p-6 lg:p-8">
			<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
						{t('thisGameweek')}
					</p>
					<h2 className="mt-1 flex items-center gap-2.5 font-display text-xl font-bold uppercase tracking-wide">
						<GameweekBadge gameweek={overallResult.event} size="sm" />
						<span>{t('gameweekStats')}</span>
					</h2>
				</div>
				<Link
					href="/data/gameweek"
					className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-primary-ink underline-offset-4 hover:underline"
				>
					{t('viewGameweekStats')}
					<ArrowRight aria-hidden="true" className="size-4" />
				</Link>
			</div>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{stats.map((stat, index) => (
					<div
						key={stat.label}
						className="rounded-lg border bg-background p-4 transition-transform hover:-translate-y-0.5 hover:shadow-sticker-sm"
					>
						<div className={`mb-3 inline-flex rounded-md p-2.5 ${tileIconStyles[index % tileIconStyles.length]}`}>
							{stat.icon}
						</div>
						<div className="space-y-1">
							<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
								{stat.label}
							</p>
							<p className="truncate font-display text-2xl font-bold text-foreground">
								{stat.value}
							</p>
						</div>
					</div>
				))}
			</div>
		</Card>
	)
}
