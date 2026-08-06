import { Card } from '@/components/ui/card'
import type { PlayerDetailData } from '@/lib/graphql/operations/players'
import type { ReactNode } from 'react'
import { Activity, Shield, Trophy } from 'lucide-react'
import {
	CompareRow,
	CompareSectionHeader,
	formatPrice,
	formatPriceDiff,
	StatCell,
} from './PlayerStatPrimitives'

interface Metric {
	label: string
	value: string | number | null
}

function MetricSection({ icon, label, metrics }: { icon?: ReactNode; label: string; metrics: Metric[] }) {
	const gridClass =
		metrics.length >= 4
			? 'grid-cols-2 md:grid-cols-4'
			: metrics.length === 3
				? 'grid-cols-3'
				: 'grid-cols-2'

	return (
		<section>
			<CompareSectionHeader icon={icon ?? null} label={label} />
			<div className={`grid gap-3 ${gridClass}`}>
				{metrics.map((metric) => (
					<StatCell key={metric.label} label={metric.label} value={metric.value} />
				))}
			</div>
		</section>
	)
}

function singlePlayerSections(player: PlayerDetailData): Array<{ label: string; icon?: ReactNode; metrics: Metric[] }> {
	const sections: Array<{ label: string; icon?: ReactNode; metrics: Metric[] }> = []

	if (player.elementType === 1) {
		sections.push(
			{
				label: 'Goalkeeping',
				icon: <Shield className="size-4" />,
				metrics: [
					{ label: 'Saves', value: player.saves },
					{ label: 'Pen. Saved', value: player.penaltiesSaved },
					{ label: 'Clean Sheets', value: player.cleanSheets },
					{ label: 'Goals Conceded', value: player.goalsConceded },
				],
			},
			{
				label: 'Outfield',
				icon: <Trophy className="size-4" />,
				metrics: [
					{ label: 'Goals', value: player.goalsScored },
					{ label: 'Assists', value: player.assists },
					{ label: 'Own Goals', value: player.ownGoals },
				],
			},
		)
	}

	if (player.elementType === 2) {
		sections.push(
			{
				label: 'Defensive',
				icon: <Shield className="size-4" />,
				metrics: [
					{ label: 'Clean Sheets', value: player.cleanSheets },
					{ label: 'Goals Conceded', value: player.goalsConceded },
					{ label: 'Own Goals', value: player.ownGoals },
					{ label: 'Pen. Saved', value: player.penaltiesSaved },
				],
			},
			{
				label: 'Attacking',
				icon: <Trophy className="size-4" />,
				metrics: [
					{ label: 'Goals', value: player.goalsScored },
					{ label: 'Assists', value: player.assists },
				],
			},
		)
	}

	if (player.elementType === 3) {
		sections.push(
			{
				label: 'Attacking',
				icon: <Trophy className="size-4" />,
				metrics: [
					{ label: 'Goals', value: player.goalsScored },
					{ label: 'Assists', value: player.assists },
				],
			},
			{
				label: 'Defensive',
				icon: <Shield className="size-4" />,
				metrics: [
					{ label: 'Clean Sheets', value: player.cleanSheets },
					{ label: 'Goals Conceded', value: player.goalsConceded },
				],
			},
		)
	}

	if (player.elementType === 4) {
		sections.push({
			label: 'Attacking',
			icon: <Trophy className="size-4" />,
			metrics: [
				{ label: 'Goals', value: player.goalsScored },
				{ label: 'Assists', value: player.assists },
			],
		})
	}

	sections.push(
		{
			label: 'Discipline',
			icon: <Activity className="size-4" />,
			metrics: [
				{ label: 'Yellow Cards', value: player.yellowCards },
				{ label: 'Red Cards', value: player.redCards },
			],
		},
		{
			label: 'FPL',
			metrics: [
				{ label: 'Bonus', value: player.bonus },
				{ label: 'BPS', value: player.bps },
				{ label: 'Minutes', value: player.minutes },
				{ label: 'Total Points', value: player.totalPoints },
			],
		},
		{
			label: 'Price',
			metrics: [
				{ label: 'Current', value: formatPrice(player.price) },
				{ label: 'Start', value: formatPrice(player.startPrice) },
				{ label: 'Change', value: formatPriceDiff(player.price, player.startPrice) ?? '—' },
			],
		},
	)

	return sections
}

export function PlayerSeasonTab({ player, comparison }: { player: PlayerDetailData; comparison: PlayerDetailData | null }) {
	if (comparison) {
		return (
			<Card className="flex flex-col gap-5 border-border/80 p-4 shadow-sm sm:p-5">
				<section>
					<CompareSectionHeader icon={<Trophy className="size-4" />} label="Attacking" />
					<CompareRow label="Goals" v1={player.goalsScored} v2={comparison.goalsScored} />
					<CompareRow label="Assists" v1={player.assists} v2={comparison.assists} />
				</section>
				<section>
					<CompareSectionHeader icon={<Shield className="size-4" />} label="Defensive" />
					<CompareRow label="Clean Sheets" v1={player.cleanSheets} v2={comparison.cleanSheets} />
					<CompareRow label="Goals Conceded" v1={player.goalsConceded} v2={comparison.goalsConceded} higherIsBetter={false} />
					<CompareRow label="Saves" v1={player.saves} v2={comparison.saves} />
					<CompareRow label="Pen. Saved" v1={player.penaltiesSaved} v2={comparison.penaltiesSaved} />
					<CompareRow label="Own Goals" v1={player.ownGoals} v2={comparison.ownGoals} higherIsBetter={false} />
				</section>
				<section>
					<CompareSectionHeader icon={<Activity className="size-4" />} label="Discipline" />
					<CompareRow label="Yellow Cards" v1={player.yellowCards} v2={comparison.yellowCards} higherIsBetter={false} />
					<CompareRow label="Red Cards" v1={player.redCards} v2={comparison.redCards} higherIsBetter={false} />
				</section>
				<section>
					<CompareSectionHeader icon={null} label="FPL" />
					<CompareRow label="Bonus" v1={player.bonus} v2={comparison.bonus} />
					<CompareRow label="BPS" v1={player.bps} v2={comparison.bps} />
					<CompareRow label="Minutes" v1={player.minutes} v2={comparison.minutes} />
					<CompareRow label="Total Points" v1={player.totalPoints} v2={comparison.totalPoints} />
				</section>
				<section>
					<CompareSectionHeader icon={null} label="Price" />
					<CompareRow label="Current" v1={formatPrice(player.price)} v2={formatPrice(comparison.price)} higherIsBetter={false} />
					<CompareRow label="Start" v1={formatPrice(player.startPrice)} v2={formatPrice(comparison.startPrice)} higherIsBetter={false} />
				</section>
			</Card>
		)
	}

	return (
		<Card className="flex flex-col gap-6 border-border/80 p-4 shadow-sm sm:p-5">
			{singlePlayerSections(player).map((section) => (
				<MetricSection key={section.label} {...section} />
			))}
		</Card>
	)
}
