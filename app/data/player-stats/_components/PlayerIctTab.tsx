import { Card } from '@/components/ui/card'
import type { PlayerDetailData } from '@/lib/graphql/operations/players'
import { Zap } from 'lucide-react'
import {
	CompareRow,
	CompareSectionHeader,
	DualIctBar,
	IctBar,
	StatCell,
} from './PlayerStatPrimitives'

export function PlayerIctTab({ player, comparison }: { player: PlayerDetailData; comparison: PlayerDetailData | null }) {
	if (comparison) {
		return (
			<Card className="flex flex-col gap-5 border-border/80 p-4 shadow-sm sm:p-5">
				<section>
					<CompareSectionHeader icon={<Zap className="size-4" />} label="ICT Values" />
					<CompareRow label="Influence" v1={player.influence} v2={comparison.influence} />
					<CompareRow label="Creativity" v1={player.creativity} v2={comparison.creativity} />
					<CompareRow label="Threat" v1={player.threat} v2={comparison.threat} />
					<CompareRow label="ICT Index" v1={player.ictIndex} v2={comparison.ictIndex} />
				</section>
				<div className="flex flex-col gap-4 pt-2">
					<DualIctBar label="Influence" v1={player.influence} v2={comparison.influence} name1={player.webName} name2={comparison.webName} max={1500} />
					<DualIctBar label="Creativity" v1={player.creativity} v2={comparison.creativity} name1={player.webName} name2={comparison.webName} max={800} />
					<DualIctBar label="Threat" v1={player.threat} v2={comparison.threat} name1={player.webName} name2={comparison.webName} max={2000} />
					<DualIctBar label="ICT Index" v1={player.ictIndex} v2={comparison.ictIndex} name1={player.webName} name2={comparison.webName} max={300} />
				</div>
			</Card>
		)
	}

	return (
		<Card className="border-border/80 p-4 shadow-sm sm:p-5">
			<CompareSectionHeader icon={<Zap className="size-4" />} label="ICT Index" />
			<div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
				<StatCell label="Influence" value={player.influence} />
				<StatCell label="Creativity" value={player.creativity} />
				<StatCell label="Threat" value={player.threat} />
				<StatCell label="ICT Index" value={player.ictIndex} />
			</div>
			<div className="flex flex-col gap-4">
				<IctBar label="Influence" value={player.influence} color="bg-info" max={1500} />
				<IctBar label="Creativity" value={player.creativity} color="bg-success" max={800} />
				<IctBar label="Threat" value={player.threat} color="bg-destructive" max={2000} />
				<IctBar label="ICT Index" value={player.ictIndex} color="bg-primary" max={300} />
			</div>
		</Card>
	)
}
