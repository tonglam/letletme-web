'use client'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_TOP_TRANSFERS_IN,
	GET_TOP_TRANSFERS_OUT,
	type TopTransfersResponse,
} from '@/lib/graphql/queries'
import { useEffect, useState } from 'react'
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

export function GameweekStatsSection({ currentEventId }: GameweekStatsSectionProps) {
	const [transfersIn, setTransfersIn] = useState<Transfer[]>([])
	const [transfersOut, setTransfersOut] = useState<Transfer[]>([])
	const [isLoading, setIsLoading] = useState(currentEventId !== null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!currentEventId) {
			setIsLoading(false)
			return
		}

		const fetchData = async () => {
			try {
				setIsLoading(true)
				setError(null)

				const [inData, outData] = await Promise.all([
					executeQuery<TopTransfersResponse>(GET_TOP_TRANSFERS_IN, {
						eventId: currentEventId,
						limit: 5,
					}),
					executeQuery<TopTransfersResponse>(GET_TOP_TRANSFERS_OUT, {
						eventId: currentEventId,
						limit: 5,
					}),
				])

				const toTransfer = (
					item: NonNullable<TopTransfersResponse['topTransfersIn']>[number],
					direction: 'in' | 'out',
				): Transfer => ({
					position: item.player.position ?? 'UNK',
					player: item.player.webName,
					club: item.player.team?.shortName ?? item.player.team?.name ?? '',
					transfers:
						direction === 'in' ? item.transfersInEvent : item.transfersOutEvent,
					selectedByPercent: item.player.selectedByPercent ?? null,
					points: item.player.totalPoints ?? null,
				})

				setTransfersIn((inData.topTransfersIn ?? []).map((i) => toTransfer(i, 'in')))
				setTransfersOut(
					(outData.topTransfersOut ?? []).map((i) => toTransfer(i, 'out')),
				)
			} catch (err) {
				console.error('Failed to fetch transfers:', err)
				setError('Failed to load transfers')
				setTransfersIn([])
				setTransfersOut([])
			} finally {
				setIsLoading(false)
			}
		}

		void fetchData()
	}, [currentEventId])

	return (
		<Card className="rounded-none sm:rounded-lg p-4 sm:p-6 lg:p-8">
			{error && (
				<div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
					<p className="text-sm text-destructive">{error}</p>
				</div>
			)}
			{isLoading ? (
				<div className="space-y-6">
					{[0, 1].map((i) => (
						<div key={i}>
							<Skeleton className="h-6 w-32 mb-4" />
							<div className="space-y-2">
								{[1, 2, 3, 4, 5].map((j) => (
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
