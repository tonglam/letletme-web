import { Card } from '@/components/ui/card'
import type { PlayerDetailData } from '@/lib/graphql/operations/players'
import { Activity, BarChart3, Trophy } from 'lucide-react'
import { CompareRow, CompareSectionHeader, StatCell } from './PlayerStatPrimitives'

export function PlayerOverviewTab({
	player,
	comparison,
	currentGameweek,
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData | null
	currentGameweek?: number
}) {
	if (comparison) {
		return (
			<Card className="flex flex-col gap-5 p-5">
				<section>
					<CompareSectionHeader icon={<BarChart3 className="size-4" />} label={`GW ${currentGameweek ?? '—'}`} />
					<CompareRow label="Points" v1={player.eventPoints} v2={comparison.eventPoints} />
				</section>
				<section>
					<CompareSectionHeader icon={<Trophy className="size-4" />} label="Season Totals" />
					<CompareRow label="Total Points" v1={player.totalPoints} v2={comparison.totalPoints} />
					<CompareRow label="Goals" v1={player.goalsScored} v2={comparison.goalsScored} />
					<CompareRow label="Assists" v1={player.assists} v2={comparison.assists} />
					<CompareRow label="Clean Sheets" v1={player.cleanSheets} v2={comparison.cleanSheets} />
					<CompareRow label="Minutes" v1={player.minutes} v2={comparison.minutes} />
				</section>
				<section>
					<CompareSectionHeader icon={<Activity className="size-4" />} label="Ownership & Transfers" />
					<CompareRow
						label="Selected By %"
						v1={player.selectedByPercent == null ? null : `${player.selectedByPercent}%`}
						v2={comparison.selectedByPercent == null ? null : `${comparison.selectedByPercent}%`}
					/>
					<CompareRow label="Season In" v1={player.seasonTransfersIn.toLocaleString()} v2={comparison.seasonTransfersIn.toLocaleString()} />
					<CompareRow label="Season Out" v1={player.seasonTransfersOut.toLocaleString()} v2={comparison.seasonTransfersOut.toLocaleString()} higherIsBetter={false} />
					<CompareRow label="GW Net" v1={(player.transfersInEvent - player.transfersOutEvent).toLocaleString()} v2={(comparison.transfersInEvent - comparison.transfersOutEvent).toLocaleString()} />
				</section>
			</Card>
		)
	}

	return (
		<Card className="flex flex-col gap-6 p-5">
			<section>
				<CompareSectionHeader icon={<BarChart3 className="size-4" />} label={`GW ${currentGameweek ?? '—'}`} />
				<StatCell label="Points" value={player.eventPoints} />
			</section>
			<section>
				<CompareSectionHeader icon={<Trophy className="size-4" />} label="Season Totals" />
				<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
					<StatCell label="Goals" value={player.goalsScored} />
					<StatCell label="Assists" value={player.assists} />
					<StatCell label="Clean Sheets" value={player.cleanSheets} />
					<StatCell label="Minutes" value={player.minutes} />
				</div>
			</section>
			<section>
				<CompareSectionHeader icon={<Activity className="size-4" />} label="Ownership & Transfers" />
				<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
					<StatCell label="Selected By" value={player.selectedByPercent == null ? null : `${player.selectedByPercent}%`} />
					<StatCell label="Season In" value={player.seasonTransfersIn.toLocaleString()} />
					<StatCell label="Season Out" value={player.seasonTransfersOut.toLocaleString()} />
					<StatCell label="GW Net" value={(player.transfersInEvent - player.transfersOutEvent).toLocaleString()} />
				</div>
			</section>
		</Card>
	)
}
