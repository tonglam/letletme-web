import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { CheckCircle2, Clock } from 'lucide-react'
import type { TeamStatsViewModel } from '../_lib/team-stats-model'

export function TeamSquadTab({ picks }: { picks: TeamStatsViewModel['eventPicks'] }) {
	return (
		<Card className="p-6">
			<h2 className="mb-4 text-xl font-bold">Picks</h2>
			<div className="overflow-hidden rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Player</TableHead>
							<TableHead className="text-center">Position</TableHead>
							<TableHead className="text-center">Min</TableHead>
							<TableHead className="text-center">Pts</TableHead>
							<TableHead className="text-right">Role</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{picks.map((pick) => {
							const isBench = pick.multiplier === 0
							const played = pick.minutes > 0

							return (
								<TableRow
									key={`${pick.position}-${pick.webName}`}
									className={isBench ? 'bg-muted/30 hover:bg-muted/40' : played ? 'bg-info/10 hover:bg-info/15' : undefined}
								>
									<TableCell>
										<div className="min-w-[180px]">
											<p className="font-medium leading-5">
												{pick.webName}{pick.isCaptain ? ' (c)' : ''}{pick.isViceCaptain ? ' (vc)' : ''}
											</p>
											<p className="mt-1 text-xs text-muted-foreground">{pick.teamName}</p>
										</div>
									</TableCell>
									<TableCell className="text-center"><Badge variant="secondary">{pick.elementTypeName}</Badge></TableCell>
									<TableCell className="text-center">
										<span className="inline-flex items-center justify-center gap-1">
											{played ? <CheckCircle2 className="size-3.5 shrink-0 text-info" aria-label="Played" /> : <Clock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Not played" />}
											{pick.minutes}
										</span>
									</TableCell>
									<TableCell className="text-center font-bold">
										<span className={pick.totalPoints > 0 ? 'text-success' : undefined}>{pick.totalPoints}</span>
									</TableCell>
									<TableCell className="text-right">
										<Badge variant={isBench ? 'outline' : 'default'}>{isBench ? 'Bench' : 'Starter'}</Badge>
									</TableCell>
								</TableRow>
							)
						})}
					</TableBody>
				</Table>
			</div>
		</Card>
	)
}
