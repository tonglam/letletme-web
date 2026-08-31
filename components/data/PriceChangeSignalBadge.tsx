import { Badge } from '@/components/ui/badge'
import type { PriceChangePredictionStatus } from '@/lib/graphql/operations/price-changes'
import { getPriceChangeUnlockDays } from '@/lib/price-change-status'
import { cn } from '@/lib/utils'
import { LockKeyhole } from 'lucide-react'
import type { ReactNode } from 'react'

function statusClass(status: PriceChangePredictionStatus): string {
	if (status.includes('RISE'))
		return 'border-success/45 bg-success/10 text-success'
	if (status.includes('FALL'))
		return 'border-destructive/45 bg-destructive/10 text-destructive'
	if (status === 'LOCKED') {
		return 'border-warning/45 bg-warning/10 text-foreground'
	}
	if (status === 'CALIBRATING') {
		return 'border-warning/45 bg-warning/10 text-warning'
	}
	return 'border-border/70 bg-muted/30 text-muted-foreground'
}

export function PriceChangeSignalBadge({
	status,
	lockedUntil,
	hydrated,
	statusLabel,
	unlocksInDaysLabel,
	className
}: {
	status: PriceChangePredictionStatus
	lockedUntil: string | null
	hydrated: boolean
	statusLabel: string
	unlocksInDaysLabel: (days: number) => ReactNode
	className?: string
}) {
	const unlockDays =
		status === 'LOCKED' && hydrated
			? getPriceChangeUnlockDays(lockedUntil)
			: null
	const label =
		unlockDays == null ? statusLabel : unlocksInDaysLabel(unlockDays)

	return (
		<Badge
			variant="outline"
			className={cn(
				'inline-flex items-center gap-1.5 whitespace-nowrap',
				statusClass(status),
				className
			)}
		>
			{status === 'LOCKED' ? (
				<LockKeyhole
					className="size-3"
					aria-hidden="true"
				/>
			) : null}
			{label}
		</Badge>
	)
}
