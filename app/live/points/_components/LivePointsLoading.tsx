import { GameweekSelector } from '@/components/data/GameweekSelector'
import { Card } from '@/components/ui/card'
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
			<Card className="mb-8 overflow-hidden border-electric/15 p-4 shadow-sticker-sm sm:p-6">
				<Skeleton className="mb-2 h-3 w-20" />
				<Skeleton className="mb-2 h-8 w-48" />
				<Skeleton className="mb-6 h-4 w-32" />
				<div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4">
					{[1, 2, 3, 4].map(item => (
						<div
							key={item}
							className="rounded-lg border border-primary/10 bg-primary/5 px-3 py-3 sm:px-4"
						>
							<Skeleton className="mb-3 h-4 w-16" />
							<Skeleton className="h-7 w-12" />
						</div>
					))}
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
