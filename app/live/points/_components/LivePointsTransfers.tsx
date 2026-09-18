'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_ENTRY_TRANSFER_HISTORY,
	type EntryTransferHistoryResponse,
	type EntryTransferMove
} from '@/lib/graphql/operations/entries'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

export function LivePointsTransfers({
	entryId,
	eventId
}: {
	entryId: number
	eventId: number
}) {
	const t = useTranslations('LivePoints')
	const [moves, setMoves] = useState<EntryTransferMove[] | null>(null)
	const [failed, setFailed] = useState(false)
	const [retry, setRetry] = useState(0)

	useEffect(() => {
		setMoves(null)
		setFailed(false)
		const controller = new AbortController()
		void executeQuery<EntryTransferHistoryResponse>(
			GET_ENTRY_TRANSFER_HISTORY,
			{ entryId },
			{ signal: controller.signal, cache: 'no-store' }
		).then(
			data => {
				if (!controller.signal.aborted) {
					setMoves(
						data.entryTransferHistory.find(week => week.eventId === eventId)
							?.transfers ?? []
					)
				}
			},
			() => {
				if (controller.signal.aborted) return
				setFailed(true)
			}
		)
		return () => controller.abort()
	}, [entryId, eventId, retry])

	// entryTransferHistory already converts FPL tenths to millions.
	const money = (value: number) => `£${value.toFixed(1)}m`

	return (
		<section
			className="mt-8"
			aria-labelledby="live-transfers-heading"
		>
			<div className="mb-3 flex items-center justify-between gap-4">
				<h2
					id="live-transfers-heading"
					className="font-display text-xl font-bold tracking-tight sm:text-2xl"
				>
					{t('gameweekTransfers')}
					<span className="ml-2 text-sm font-normal text-muted-foreground">
						GW{eventId}
					</span>
				</h2>
				<Button
					variant="ghost"
					size="sm"
					disabled={!failed && moves === null}
					onClick={() => setRetry(value => value + 1)}
				>
					{t('refreshTransfers')}
				</Button>
			</div>
			<Card className="p-4">
				{failed ? (
					<p
						role="alert"
						className="text-sm text-destructive"
					>
						{t('transfersFailed')}
					</p>
				) : moves === null ? (
					<p
						role="status"
						className="text-sm text-muted-foreground"
					>
						{t('transfersLoading')}
					</p>
				) : moves.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						{t('noGameweekTransfers')}
					</p>
				) : (
					<ul className="divide-y divide-border/50">
						{moves.map((move, index) => (
							<li
								key={`${move.time}:${index}`}
								className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 py-3 first:pt-0 last:pb-0"
							>
								<div className="min-w-0">
									<p className="text-xs text-muted-foreground">
										{t('transferOut')}
									</p>
									<p className="font-semibold">{move.elementOutWebName}</p>
									<p className="text-xs text-muted-foreground">
										{move.elementOutTeamShortName} ·{' '}
										{money(move.elementOutCost)}
									</p>
								</div>
								<ArrowRight
									className="size-4 text-muted-foreground"
									aria-hidden="true"
								/>
								<div className="min-w-0">
									<p className="text-xs text-muted-foreground">
										{t('transferIn')}
									</p>
									<p className="font-semibold">{move.elementInWebName}</p>
									<p className="text-xs text-muted-foreground">
										{move.elementInTeamShortName} · {money(move.elementInCost)}
									</p>
								</div>
							</li>
						))}
					</ul>
				)}
			</Card>
		</section>
	)
}
