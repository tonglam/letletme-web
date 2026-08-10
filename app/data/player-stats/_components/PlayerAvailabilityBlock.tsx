'use client'

import type { MarketAvailabilityUpdate } from '@/lib/graphql/operations/market'
import { Badge } from '@/components/ui/badge'
import {
	availabilityBodyText,
	marketAvailabilityStatusKey,
} from '@/lib/market-availability'
import { useTranslations } from 'next-intl'

export function PlayerAvailabilityBlock({
	update,
}: {
	update: MarketAvailabilityUpdate | null
}) {
	const t = useTranslations('Market')
	const tPs = useTranslations('PlayerStats')

	if (!update) {
		return (
			<p className="text-sm text-muted-foreground">{tPs('availabilityNone')}</p>
		)
	}

	const statusKey = marketAvailabilityStatusKey(update.status)
	const chance =
		update.chanceOfPlayingThisRound ?? update.chanceOfPlayingNextRound

	return (
		<div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-3">
			<div className="mb-2 flex flex-wrap items-center gap-2">
				<p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
					{tPs('availabilityTitle')}
				</p>
				<Badge variant="outline" className="text-[10px]">
					{t(`status.${statusKey}`)}
				</Badge>
				{chance != null ? (
					<span className="text-xs text-muted-foreground">
						{tPs('availabilityChance', { percent: chance })}
					</span>
				) : null}
			</div>
			<p className="text-sm leading-relaxed text-foreground">
				{availabilityBodyText(update, key => t(key))}
			</p>
		</div>
	)
}
