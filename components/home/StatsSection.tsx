import { Card } from '@/components/ui/card'
import type {
	ChipPlay,
	EventOverallResult,
} from '@/lib/graphql/operations/events'
import homeStats from '@/lib/home-stats'
import { formatCompactNumber } from '@/lib/utils'
import { ArrowRightCircle, Crown, Trophy, Zap } from 'lucide-react'
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
				<div className="mb-6 flex items-center justify-between">
					<h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
						<span className="rounded-md bg-plum px-2 py-1 font-mono text-xs font-semibold tracking-[0.14em] text-electric">
							GW
						</span>
						<span>{t('gameweekStats')}</span>
					</h2>
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
			<div className="mb-6 flex items-center justify-between">
				<h2 className="flex items-center gap-2.5 font-display text-xl font-bold uppercase tracking-wide">
					<span className="rounded-md bg-plum px-2 py-1 font-mono text-xs font-semibold tracking-[0.14em] text-electric">
						GW{currentEventId}
					</span>
					<span>{t('gameweekStats')}</span>
				</h2>
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
