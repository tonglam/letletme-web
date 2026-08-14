import PageShell from '@/components/layout/PageShell'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Server-safe route loading UI (no i18n hooks). Used by app loading.tsx files. */
export type RouteLoadingVariant = 'dashboard' | 'list' | 'stats' | 'form'

export function RouteLoadingSkeleton({
	variant = 'dashboard',
	className,
}: {
	variant?: RouteLoadingVariant
	className?: string
}) {
	return (
		<PageShell>
			<div
				className={cn('mx-auto w-full max-w-4xl px-4 py-8', className)}
				aria-busy="true"
				aria-live="polite"
			>
				{/* Header — matches StatsPageHeader rhythm */}
				<div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
					<div className="min-w-0 space-y-2">
						<Skeleton className="h-3 w-24" />
						<Skeleton className="h-8 w-48 sm:h-9 sm:w-64" />
					</div>
					<Skeleton className="h-7 w-16 shrink-0 rounded-md" />
				</div>

				{variant === 'form' ? <FormSkeleton /> : null}
				{variant === 'list' ? <ListSkeleton /> : null}
				{variant === 'stats' ? <StatsSkeleton /> : null}
				{variant === 'dashboard' ? <DashboardSkeleton /> : null}

				<span className="sr-only">Loading</span>
			</div>
		</PageShell>
	)
}

function MetricTiles({ count = 4 }: { count?: number }) {
	return (
		<div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
			{Array.from({ length: count }, (_, i) => (
				<div
					key={i}
					className="rounded-lg border surface-inset p-3 sm:p-4"
				>
					<Skeleton className="mb-3 h-3 w-16" />
					<Skeleton className="h-7 w-12 sm:h-8" />
				</div>
			))}
		</div>
	)
}

function RowList({ rows = 6 }: { rows?: number }) {
	return (
		<div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
			<div className="divide-y divide-border/50">
				{Array.from({ length: rows }, (_, i) => (
					<div key={i} className="flex items-center gap-3 px-4 py-3">
						<Skeleton className="h-4 w-6 shrink-0" />
						<div className="min-w-0 flex-1 space-y-2">
							<Skeleton className="h-4 w-40 max-w-full" />
							<Skeleton className="h-3 w-28 max-w-full" />
						</div>
						<Skeleton className="h-5 w-10 shrink-0" />
					</div>
				))}
			</div>
		</div>
	)
}

function DashboardSkeleton() {
	return (
		<>
			<Card className="mb-6 p-4 shadow-sm sm:p-6">
				<Skeleton className="mb-3 h-5 w-40" />
				<Skeleton className="mb-6 h-4 w-28" />
				<MetricTiles />
			</Card>
			<Card className="mb-6 p-4 shadow-sm">
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4">
					<Skeleton className="h-10 w-full rounded-md" />
					<Skeleton className="h-10 w-full rounded-md" />
				</div>
			</Card>
			<RowList />
		</>
	)
}

function ListSkeleton() {
	return (
		<>
			<Card className="mb-6 p-4 shadow-sm">
				<div className="flex flex-col gap-3 sm:flex-row">
					<Skeleton className="h-10 flex-1 rounded-md" />
					<Skeleton className="h-10 w-full rounded-md sm:w-32" />
				</div>
			</Card>
			<RowList rows={8} />
		</>
	)
}

function StatsSkeleton() {
	return (
		<>
			<MetricTiles count={4} />
			<Card className="mb-6 p-2 shadow-sm sm:p-3">
				<div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
					{Array.from({ length: 4 }, (_, i) => (
						<Skeleton key={i} className="h-9 w-full rounded-md" />
					))}
				</div>
			</Card>
			<Card className="overflow-hidden shadow-sm">
				<div className="border-b border-border/50 p-4">
					<Skeleton className="h-5 w-36" />
				</div>
				<div className="overflow-x-auto p-4">
					<div className="min-w-[32rem] space-y-3">
						<Skeleton className="h-8 w-full" />
						{Array.from({ length: 6 }, (_, i) => (
							<Skeleton key={i} className="h-10 w-full" />
						))}
					</div>
				</div>
			</Card>
		</>
	)
}

function FormSkeleton() {
	return (
		<div className="space-y-4">
			{Array.from({ length: 3 }, (_, i) => (
				<Card key={i} className="p-4 shadow-sm sm:p-6">
					<Skeleton className="mb-4 h-6 w-40" />
					<div className="space-y-3">
						<Skeleton className="h-10 w-full rounded-md" />
						<Skeleton className="h-10 w-full rounded-md" />
						<Skeleton className="h-24 w-full rounded-md" />
					</div>
				</Card>
			))}
			<div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
				<Skeleton className="h-11 w-full rounded-md sm:w-40" />
			</div>
		</div>
	)
}
