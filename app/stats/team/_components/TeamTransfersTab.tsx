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
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { formatPlayerValue, type TeamStatsViewModel } from '../_lib/team-stats-model'

export function TeamTransfersTab({ rows }: { rows: TeamStatsViewModel['transferRows'] }) {
	const t = useTranslations('TeamStats')
	return (
		<Card className="border-border/80 p-4 shadow-sm sm:p-6">
			<h2 className="mb-4 font-display text-lg font-bold tracking-tight sm:text-xl">
				{t('transferHistory')}
			</h2>
			<div className="overflow-hidden rounded-lg border bg-card/40">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-20 text-center">{t('gameweekShort')}</TableHead>
							<TableHead className="w-32 text-center">{t('transfers')}</TableHead>
							<TableHead className="w-32 text-center">{t('cost')}</TableHead>
							<TableHead className="min-w-[360px]">{t('moves')}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => (
							<TableRow key={row.gameweek} className={row.transfers > 0 ? 'bg-info/5 hover:bg-info/10' : 'bg-muted/10 hover:bg-muted/20'}>
								<TableCell className="text-center font-medium text-muted-foreground">{row.gameweek}</TableCell>
								<TableCell className="text-center">
									<Badge variant={row.transfers > 0 ? 'default' : 'secondary'}>{row.transfers}</Badge>
								</TableCell>
								<TableCell className="text-center">
									<span className={row.cost > 0 ? 'font-semibold text-destructive' : 'font-medium text-muted-foreground'}>
										{row.cost > 0 ? `-${row.cost}` : '0'}
									</span>
								</TableCell>
								<TableCell>
									<div className="flex flex-col gap-2 py-1">
										{row.moves.length === 0 ? (
											<p className="rounded-md border border-dashed bg-background/60 px-3 py-2.5 text-sm text-muted-foreground">
												{row.transfers > 0 ? t('detailsUnavailable') : t('noTransfer')}
											</p>
										) : (
											row.moves.map((move, index) => (
												<div key={`${row.gameweek}-${move.outName}-${move.inName}-${index}`} className="rounded-md border bg-background/80 px-3 py-2.5">
													<p className="flex flex-wrap items-center gap-1 text-sm font-medium leading-5">
												<span className="text-muted-foreground">{t('out')}</span> {move.outName} ({move.outTeam})
														<ArrowRight className="mx-1 size-3.5 text-muted-foreground" aria-hidden="true" />
												<span className="text-muted-foreground">{t('in')}</span> {move.inName} ({move.inTeam})
													</p>
											<p className="mt-1.5 text-xs text-muted-foreground">{t('soldBought', { sold: formatPlayerValue(move.outCost), bought: formatPlayerValue(move.inCost) })}</p>
												</div>
											))
										)}
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</Card>
	)
}
