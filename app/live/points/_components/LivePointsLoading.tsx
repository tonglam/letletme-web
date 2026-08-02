import { GameweekSelector } from '@/components/data/GameweekSelector'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'

export function LivePointsLoading({
	entrySearch,
	activeEntryId,
	currentGameweek,
	selectedGameweek,
}: {
	entrySearch?: ReactNode
	activeEntryId: number
	currentGameweek: number
	selectedGameweek?: number
}) {
	const t = useTranslations('LivePoints')
	return (
		<>
			{entrySearch ? <Card className="mb-4 p-4">{entrySearch}</Card> : null}
			<div className="mb-6">
				{selectedGameweek !== undefined ? (
					<GameweekSelector
						onGameweekChange={() => undefined}
						currentGameweek={currentGameweek}
						selectedGameweek={selectedGameweek}
						disabled
					/>
				) : (
					<Skeleton className="h-16 w-full rounded-lg" />
				)}
				<p className="mt-2 text-xs text-muted-foreground">{t('loadingEntry', { entryId: activeEntryId })}</p>
			</div>
			<Card className="mb-8 p-6">
				<Skeleton className="mb-2 h-8 w-48" />
				<Skeleton className="mb-8 h-5 w-32" />
				<div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
					{[1, 2, 3, 4].map((item) => (
						<div key={item} className="rounded-lg bg-primary/5 p-4">
							<Skeleton className="mb-3 h-5 w-20" />
							<Skeleton className="h-8 w-16" />
						</div>
					))}
				</div>
				<Separator className="my-6" />
				<Skeleton className="mb-3 h-5 w-24" />
				<div className="flex gap-2">
					<Skeleton className="h-6 w-16 rounded-full" />
					<Skeleton className="h-6 w-20 rounded-full" />
				</div>
			</Card>
			<Card className="mb-8 overflow-hidden">
				{Array.from({ length: 11 }, (_, index) => (
					<div key={index} className="border-b p-4 last:border-b-0">
						<div className="flex items-center justify-between">
							<div className="flex flex-1 items-center gap-4">
								<Skeleton className="h-4 w-12" />
								<Skeleton className="h-4 w-20" />
								<Skeleton className="h-4 w-32" />
							</div>
							<Skeleton className="h-12 w-16" />
						</div>
					</div>
				))}
			</Card>
		</>
	)
}
