'use client'

import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { positionBadgeClass } from '@/lib/position-style'

export interface PriceChange {
	position: string
	player: string
	club: string
	price: number
	priceChange?: number
}

const PAGE_SIZE = 5

function PriceList({
	title,
	changes,
	type
}: {
	title: string
	changes: PriceChange[]
	type: 'rise' | 'fall'
}) {
	const t = useTranslations('Home')
	const [page, setPage] = useState(0)

	const pages = Math.ceil(changes.length / PAGE_SIZE)
	const safePage = pages > 0 ? Math.min(page, pages - 1) : 0

	const icon =
		type === 'rise' ? (
			<TrendingUp aria-hidden="true" className="size-5 shrink-0 text-success" />
		) : (
			<TrendingDown aria-hidden="true" className="size-5 shrink-0 text-destructive" />
		)

	const priceClassName =
		type === 'rise'
			? 'text-success'
			: 'text-destructive'

	const bgClassName =
		type === 'rise'
			? 'border-success/30'
			: 'border-destructive/30'

	const dotActiveColor = type === 'rise' ? 'bg-success' : 'bg-destructive'

	const visibleChanges = changes.slice(
		safePage * PAGE_SIZE,
		safePage * PAGE_SIZE + PAGE_SIZE
	)

	return (
		<div className="flex h-full flex-col">
			<div className="mb-4 flex items-center gap-2">
				{icon}
				<h3 className="font-display text-lg font-bold uppercase tracking-[0.1em]">{title}</h3>
				{changes.length > 0 && (
					<Badge
						variant="secondary"
						className="ml-auto"
					>
						{changes.length}
					</Badge>
				)}
			</div>
			<div className={`flex flex-1 flex-col gap-2 rounded-xl border p-3 ${bgClassName}`}>
				{changes.length === 0 ? (
					<div className="text-center py-8 text-muted-foreground text-sm">
						{type === 'rise' ? t('noRises') : t('noFalls')}
					</div>
				) : (
					<div className="flex flex-col gap-2">
						{visibleChanges.map((change, index) => (
							<div
								key={`${safePage}-${change.player}-${index}`}
								className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-background/80 p-3 text-left"
							>
								<Badge
									variant="secondary"
									className={`shrink-0 text-xs font-semibold ${positionBadgeClass(change.position)}`}
								>
									{change.position}
								</Badge>

								<div className="flex-1 min-w-0">
									<div className="mb-1 flex items-center gap-2">
										<span className="truncate text-sm font-semibold">
											{change.player}
										</span>
									</div>
									<span className="text-xs text-muted-foreground truncate block">
										{change.club}
									</span>
								</div>

								<div className="flex flex-col items-end shrink-0">
									<span className={`text-base font-bold ${priceClassName}`}>
										£{(change.price / 10).toFixed(1)}m
									</span>
									{change.priceChange !== undefined && (
										<span className={`text-xs ${priceClassName} font-medium`}>
											{type === 'rise' ? '+' : ''}£
											{(Math.abs(change.priceChange) / 10).toFixed(1)}m
										</span>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
			{pages > 1 && (
				<div className="mt-3 flex justify-center gap-1">
					{Array.from({ length: pages }).map((_, i) => (
						<button
							key={i}
							onClick={() => setPage(i)}
							className="flex size-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							aria-label={t('goToPage', { page: i + 1 })}
							aria-current={i === safePage ? 'page' : undefined}
						>
							<span className={`h-1.5 rounded-full transition-[width] ${i === safePage ? `w-4 ${dotActiveColor}` : 'w-1.5 bg-muted-foreground/40'}`} />
						</button>
					))}
				</div>
			)}
		</div>
	)
}

export function PriceChangesSectionClient({
	priceRises,
	priceFalls,
	hasError,
}: {
	priceRises: PriceChange[]
	priceFalls: PriceChange[]
	hasError?: boolean
}) {
	const t = useTranslations('Home')
	const hasChanges = priceRises.length > 0 || priceFalls.length > 0

	return (
		<Card className="overflow-hidden rounded-none sm:rounded-xl">
			<CardHeader className="pb-4">
				<p className="chyron">{t('transferMarket')}</p>
				<CardTitle asChild className="font-display text-2xl font-bold uppercase tracking-wide">
					<h2>{t('marketMovement')}</h2>
				</CardTitle>
				<CardDescription>{t('marketDescription')}</CardDescription>
			</CardHeader>
			<CardContent>
				{hasError && (
					<Alert variant="destructive" className="mb-5">
						<AlertTitle>{t('priceDataUnavailable')}</AlertTitle>
						<AlertDescription>{t('priceChangesFailed')}</AlertDescription>
					</Alert>
				)}
				{!hasError || hasChanges ? (
					<div className="grid gap-6 md:grid-cols-2 lg:gap-8">
						<PriceList
							title={t('priceRises')}
							changes={priceRises}
							type="rise"
						/>
						<PriceList
							title={t('priceFalls')}
							changes={priceFalls}
							type="fall"
						/>
					</div>
				) : null}
			</CardContent>
		</Card>
	)
}
