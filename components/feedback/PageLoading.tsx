import PageShell from '@/components/layout/PageShell'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslations } from 'next-intl'


export function PageLoading({ label }: { label?: string }) {
	const t = useTranslations('Common')
	const accessibleLabel = label ?? t('loadingPage')
	return (
		<PageShell>
			<div className="mx-auto w-full max-w-4xl px-4 py-8" aria-busy="true" aria-label={accessibleLabel}>
				<div className="mb-8 flex items-center justify-between gap-4">
					<div className="flex flex-col gap-3">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-9 w-56" />
					</div>
					<Skeleton className="size-10 rounded-md" />
				</div>
				<Card className="p-6">
					<div className="flex flex-col gap-4">
						<Skeleton className="h-10 w-full" />
						{Array.from({ length: 5 }, (_, index) => (
							<Skeleton key={index} className="h-16 w-full" />
						))}
					</div>
				</Card>
				<span className="sr-only">{accessibleLabel}</span>
			</div>
		</PageShell>
	)
}
