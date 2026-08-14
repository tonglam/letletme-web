import { GameweekBadge } from '@/components/stats/GameweekBadge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Link } from '@/i18n/navigation'
import { type TopTransfer } from '@/lib/graphql/operations/prices'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { TransferList } from './TransferList'

interface Transfer {
	position: string
	player: string
	club: string
	transfers: number
	selectedByPercent?: number | null
	points?: number | null
}

interface GameweekStatsSectionProps {
	currentEventId: number | null
	transfersIn?: TopTransfer[]
	transfersOut?: TopTransfer[]
	hasError?: boolean
}

export function GameweekStatsSectionFallback() {
	return (
		<GameweekStatsCard
			transfersIn={[]}
			transfersOut={[]}
			isLoading
			currentEventId={null}
		/>
	)
}

function GameweekStatsCard({
	transfersIn,
	transfersOut,
	isLoading = false,
	hasError,
	currentEventId = null
}: {
	transfersIn: Transfer[]
	transfersOut: Transfer[]
	isLoading?: boolean
	hasError?: boolean
	currentEventId?: number | null
}) {
	const t = useTranslations('Home')
	return (
		<Card className="rounded-none p-4 sm:rounded-lg sm:p-6 lg:p-8">
			<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<p className="eyebrow">{t('thisGameweek')}</p>
					<h2 className="mt-1 flex items-center gap-2.5 font-display text-xl font-bold uppercase tracking-wide">
						<GameweekBadge
							gameweek={currentEventId}
							size="sm"
							fontFamily="display"
						/>
						<span>{t('transferDesk')}</span>
					</h2>
				</div>
				<Link
					href="/explore/selections"
					prefetch={false}
					className="inline-flex min-h-9 shrink-0 items-center gap-1.5 text-sm font-semibold text-primary-ink underline-offset-4 hover:underline"
				>
					{t('viewSelections')}
					<ArrowRight
						aria-hidden="true"
						className="size-4"
					/>
				</Link>
			</div>
			{hasError && (
				<div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
					<p className="text-sm text-destructive">{t('transfersFailed')}</p>
				</div>
			)}
			{isLoading ? (
				<div className="space-y-6">
					{[0, 1].map(i => (
						<div key={i}>
							<Skeleton className="h-6 w-32 mb-4" />
							<div className="space-y-2">
								{[1, 2, 3, 4, 5].map(j => (
									<Skeleton
										key={j}
										className="h-14 w-full rounded-lg"
									/>
								))}
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="space-y-6">
					<TransferList
						title={t('topTransfersIn')}
						transfers={transfersIn}
						type="in"
					/>
					<TransferList
						title={t('topTransfersOut')}
						transfers={transfersOut}
						type="out"
					/>
				</div>
			)}
		</Card>
	)
}

const toTransfer = (item: TopTransfer, direction: 'in' | 'out'): Transfer => ({
	position: item.player.position ?? 'UNK',
	player: item.player.webName,
	club: item.player.team?.shortName ?? item.player.team?.name ?? '',
	transfers:
		direction === 'in' ? item.transfersInEvent : item.transfersOutEvent,
	selectedByPercent: item.player.selectedByPercent ?? null,
	points: item.player.totalPoints ?? null
})

export function GameweekStatsSection({
	currentEventId,
	transfersIn = [],
	transfersOut = [],
	hasError = false
}: GameweekStatsSectionProps) {
	return (
		<GameweekStatsCard
			transfersIn={transfersIn.map(item => toTransfer(item, 'in'))}
			transfersOut={transfersOut.map(item => toTransfer(item, 'out'))}
			hasError={hasError}
			currentEventId={currentEventId}
		/>
	)
}
