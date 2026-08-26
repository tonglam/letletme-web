import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'

interface SelectedFilterBadgeProps {
	name: string
	details: string
	removeLabel: string
	onRemove: () => void
}

export function SelectedFilterBadge({
	name,
	details,
	removeLabel,
	onRemove
}: SelectedFilterBadgeProps) {
	return (
		<Badge
			variant="outline"
			className="max-w-full min-w-0 shrink gap-2 overflow-hidden rounded-md px-2 py-1"
		>
			<span className="shrink-0 whitespace-nowrap font-medium">{name}</span>
			<span className="min-w-0 flex-1 truncate whitespace-nowrap text-muted-foreground">
				{details}
			</span>
			<button
				type="button"
				aria-label={removeLabel}
				className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground"
				onClick={onRemove}
			>
				<X className="h-3.5 w-3.5" />
			</button>
		</Badge>
	)
}
