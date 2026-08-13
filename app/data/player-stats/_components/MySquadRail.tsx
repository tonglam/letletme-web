'use client'

import type { SquadPickSeed } from '@/lib/squad-picks'
import { positionBadgeClass } from '@/lib/position-style'
import { positionCodeFromElementTypeName } from '@/lib/squad-picks'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

export function MySquadRail({
	picks,
	selectedPlayerId,
	onSelect,
}: {
	picks: SquadPickSeed[]
	selectedPlayerId?: string | null
	onSelect: (playerId: number) => void
}) {
	const t = useTranslations('PlayerStats')

	if (picks.length === 0) return null

	const sorted = [...picks].sort((a, b) => a.position - b.position)

	return (
		<>
			<p className="mb-2 font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
				{t('mySquadRailTitle')}
			</p>
			<div className="flex flex-wrap gap-1.5">
				{sorted.map(pick => {
					const id = pick.elementId
					if (id == null) return null
					const code = positionCodeFromElementTypeName(pick.elementTypeName)
					const isSelected = selectedPlayerId === String(id)
					return (
						<Button
							key={`${id}-${pick.position}`}
							type="button"
							variant={isSelected ? 'default' : 'outline'}
							size="sm"
							onClick={() => onSelect(id)}
							className={cn(
								'h-7 gap-1 rounded-full px-2.5 text-xs',
								!isSelected && 'border-border/70',
							)}
						>
							<Badge
								className={cn(
									positionBadgeClass(code),
									'px-1 py-0 text-[9px] font-bold',
								)}
							>
								{code}
							</Badge>
							<span>{pick.webName}</span>
						</Button>
					)
				})}
			</div>
		</>
	)
}
