import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_TOP_TRANSFERS_IN,
	GET_TOP_TRANSFERS_OUT,
	type TopTransfer,
	type TopTransfersResponse,
} from '@/lib/graphql/queries'
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
}

export function GameweekStatsSectionFallback() {
	return (
		<GameweekStatsCard
			transfersIn={[]}
			transfersOut={[]}
			isLoading
		/>
	)
}

function GameweekStatsCard({
	transfersIn,
	transfersOut,
	isLoading = false,
	error,
}: {
	transfersIn: Transfer[]
	transfersOut: Transfer[]
	isLoading?: boolean
	error?: string | null
}) {
	return (
		<Card className="rounded-none sm:rounded-lg p-4 sm:p-6 lg:p-8">
			{error && (
				<div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
					<p className="text-sm text-destructive">{error}</p>
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
						title="Top Transfers In"
						transfers={transfersIn}
						type="in"
					/>
					<TransferList
						title="Top Transfers Out"
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
	transfers: direction === 'in' ? item.transfersInEvent : item.transfersOutEvent,
	selectedByPercent: item.player.selectedByPercent ?? null,
	points: item.player.totalPoints ?? null,
})

export async function GameweekStatsSection({ currentEventId }: GameweekStatsSectionProps) {
	if (!currentEventId) {
		return (
			<GameweekStatsCard
				transfersIn={[]}
				transfersOut={[]}
			/>
		)
	}

	let transfersIn: Transfer[] = []
	let transfersOut: Transfer[] = []
	let error: string | null = null

	try {
		const [inData, outData] = await Promise.all([
			executeQuery<TopTransfersResponse>(
				GET_TOP_TRANSFERS_IN,
				{
					eventId: currentEventId,
					limit: 5,
				},
				{ cache: 'force-cache', next: { revalidate: 300 } },
			),
			executeQuery<TopTransfersResponse>(
				GET_TOP_TRANSFERS_OUT,
				{
					eventId: currentEventId,
					limit: 5,
				},
				{ cache: 'force-cache', next: { revalidate: 300 } },
			),
		])

		transfersIn = (inData.topTransfersIn ?? []).map(i => toTransfer(i, 'in'))
		transfersOut = (outData.topTransfersOut ?? []).map(i => toTransfer(i, 'out'))
	} catch (err) {
		console.error('Failed to fetch transfers:', err)
		error = 'Failed to load transfers'
	}

	return (
		<GameweekStatsCard
			transfersIn={transfersIn}
			transfersOut={transfersOut}
			error={error}
		/>
	)
}
