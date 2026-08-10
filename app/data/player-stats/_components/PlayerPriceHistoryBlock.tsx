'use client'

import { executeQuery } from '@/lib/graphql-client'
import {
	GET_PLAYER_VALUE_HISTORY,
	type PlayerValueHistoryItem,
	type PlayerValueHistoryResponse
} from '@/lib/graphql/operations/prices'
import { parseCalendarDate } from '@/lib/calendar-date'
import { Skeleton } from '@/components/ui/skeleton'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

export function PlayerPriceHistoryBlock({
	playerId,
	playerName
}: {
	playerId: number
	playerName?: string
}) {
	const t = useTranslations('PlayerStats')
	const format = useFormatter()
	const [history, setHistory] = useState<PlayerValueHistoryItem[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false

		void Promise.resolve().then(async () => {
			if (cancelled) return
			setIsLoading(true)
			setError(null)
			try {
				const data = await executeQuery<PlayerValueHistoryResponse>(
					GET_PLAYER_VALUE_HISTORY,
					{ playerId }
				)
				if (!cancelled) setHistory(data.playerValueHistory ?? [])
			} catch {
				if (cancelled) return
				setHistory([])
				setError(t('priceHistoryFailed'))
			} finally {
				if (!cancelled) setIsLoading(false)
			}
		})

		return () => {
			cancelled = true
		}
	}, [playerId, t])

	if (isLoading) {
		return (
			<div
				className="space-y-2"
				aria-busy="true"
			>
				<Skeleton className="h-4 w-40" />
				<Skeleton className="h-24 w-full rounded-lg" />
			</div>
		)
	}

	if (error) {
		return <p className="text-sm text-muted-foreground">{error}</p>
	}

	if (history.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">{t('priceHistoryEmpty')}</p>
		)
	}

	const recent = [...history]
		.sort((a, b) => b.changeDate.localeCompare(a.changeDate))
		.slice(0, 8)

	return (
		<div>
			<p className="mb-2 font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
				{playerName
					? t('priceHistoryFor', { player: playerName })
					: t('priceHistoryTitle')}
			</p>
			<ul className="divide-y divide-border/60 rounded-lg border border-border/60 text-sm">
				{recent.map(item => {
					const date = parseCalendarDate(item.changeDate)
					const dateLabel = date
						? format.dateTime(date, { dateStyle: 'medium' })
						: item.changeDate
					const priceLabel = `£${(item.newValue / 10).toFixed(1)}m`
					const delta = item.newValue - item.oldValue
					const deltaLabel =
						delta === 0
							? null
							: `${delta > 0 ? '+' : ''}${(delta / 10).toFixed(1)}m`

					return (
						<li
							key={`${item.changeDate}-${item.newValue}`}
							className="flex items-center justify-between gap-3 px-3 py-2"
						>
							<span className="text-muted-foreground">{dateLabel}</span>
							<span className="font-medium tabular-nums">{priceLabel}</span>
							<span
								className={
									delta > 0
										? 'text-xs tabular-nums text-success'
										: delta < 0
											? 'text-xs tabular-nums text-destructive'
											: 'text-xs text-muted-foreground'
								}
							>
								{deltaLabel ?? '—'}
							</span>
						</li>
					)
				})}
			</ul>
		</div>
	)
}
