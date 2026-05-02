import { Card } from '@/components/ui/card'
import type {
	ChipPlay,
	EventOverallResult,
} from '@/lib/graphql/queries'
import homeStats from '@/lib/home-stats'
import { formatChipName, formatCompactNumber } from '@/lib/utils'
import { ArrowRightCircle, Crown, Trophy, Zap } from 'lucide-react'

interface StatsSectionProps {
	currentEventId: number | null
	overallResult: EventOverallResult | null
}

const iconBgs = [
	'bg-yellow-100 dark:bg-yellow-900/20',
	'bg-blue-100 dark:bg-blue-900/20',
	'bg-purple-100 dark:bg-purple-900/20',
	'bg-green-100 dark:bg-green-900/20',
]

export function StatsSection({ currentEventId, overallResult }: StatsSectionProps) {
	if (!overallResult || !currentEventId) {
		return (
			<Card className="rounded-none sm:rounded-lg p-4 sm:p-6 lg:p-8">
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-xl font-bold flex items-center gap-2">
						<span className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-sm font-semibold">
							GW
						</span>
						<span>Gameweek Stats</span>
					</h2>
				</div>
				<div className="text-center py-12 text-muted-foreground">
					<p className="text-sm">No stats available</p>
				</div>
			</Card>
		)
	}

	const mostPlayedChip = (overallResult.chipPlays ?? []).reduce<ChipPlay | null>(
		(max, chip) => (!max || chip.numberPlayed > max.numberPlayed ? chip : max),
		null,
	)

	const stats = [
		{
			label: 'Highest Score',
			value: overallResult.highestScore?.toString() ?? '0',
			icon: <Trophy className="w-5 h-5 text-yellow-500" />,
		},
		{
			label: 'Top Scorer',
			value: homeStats.formatTopScorerValue(overallResult.topElementInfo),
			icon: <Zap className="w-5 h-5 text-blue-500" />,
		},
		{
			label: 'Most Selected Captain',
			value: overallResult.mostCaptainedPlayer?.webName ?? 'N/A',
			icon: <Crown className="w-5 h-5 text-purple-500" />,
		},
		{
			label: 'Top Chip Played',
			value: mostPlayedChip
				? `${formatChipName(mostPlayedChip.chipName)} (${formatCompactNumber(mostPlayedChip.numberPlayed)})`
				: 'N/A',
			icon: <ArrowRightCircle className="w-5 h-5 text-green-500" />,
		},
	]

	return (
		<Card className="rounded-none sm:rounded-lg p-4 sm:p-6 lg:p-8">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-xl font-bold flex items-center gap-2">
					<span className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-sm font-semibold">
						{`GW${currentEventId}`}
					</span>
					<span>Gameweek Stats</span>
				</h2>
			</div>
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{stats.map((stat, index) => (
					<div
						key={index}
						className="group p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
					>
						<div className={`inline-flex p-3 rounded-lg mb-3 ${iconBgs[index]}`}>
							{stat.icon}
						</div>
						<div className="space-y-1">
							<p className="text-xs sm:text-sm text-muted-foreground font-medium">
								{stat.label}
							</p>
							<p className="text-2xl font-bold text-foreground">{stat.value}</p>
						</div>
					</div>
				))}
			</div>
		</Card>
	)
}
