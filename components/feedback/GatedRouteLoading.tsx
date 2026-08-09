import PageShell from '@/components/layout/PageShell'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Minimal route loading for isCurrent-gated pages.
 * Avoid full dashboard skeletons that flash before PageState when current is missing.
 */
export function GatedRouteLoading() {
	return (
		<PageShell>
			<div
				className="mx-auto w-full max-w-4xl px-4 py-12"
				aria-busy="true"
				aria-live="polite"
			>
				<Skeleton className="mb-3 h-4 w-28" />
				<Skeleton className="mb-8 h-8 w-52" />
				<div className="rounded-xl border border-border/70 bg-card p-8 shadow-sm">
					<Skeleton className="mx-auto mb-4 size-12 rounded-2xl" />
					<Skeleton className="mx-auto mb-2 h-7 w-56" />
					<Skeleton className="mx-auto h-4 w-full max-w-md" />
					<Skeleton className="mx-auto mt-2 h-4 w-2/3 max-w-sm" />
				</div>
				<span className="sr-only">Loading</span>
			</div>
		</PageShell>
	)
}
