'use client'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface PriceChange {
	position: string
	player: string
	club: string
	price: number
	priceChange?: number
}

const PAGE_SIZE = 5
const AUTOPLAY_INTERVAL = 3500

function PriceList({
	title,
	changes,
	type
}: {
	title: string
	changes: PriceChange[]
	type: 'rise' | 'fall'
}) {
	const [page, setPage] = useState(0)
	const [animating, setAnimating] = useState(false)
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

	const pages = Math.ceil(changes.length / PAGE_SIZE)

	const advance = useCallback(() => {
		setAnimating(true)
		setTimeout(() => {
			setPage(p => (p + 1) % pages)
			setAnimating(false)
		}, 250)
	}, [pages])

	useEffect(() => {
		if (pages <= 1) return
		timerRef.current = setInterval(advance, AUTOPLAY_INTERVAL)
		return () => {
			if (timerRef.current) clearInterval(timerRef.current)
		}
	}, [advance, pages])

	useEffect(() => {
		const resetTimer = setTimeout(() => setPage(0), 0)
		return () => clearTimeout(resetTimer)
	}, [changes])

	const icon =
		type === 'rise' ? (
			<TrendingUp className="w-5 h-5 shrink-0 text-emerald-500" />
		) : (
			<TrendingDown className="w-5 h-5 shrink-0 text-rose-500" />
		)

	const priceClassName =
		type === 'rise'
			? 'text-emerald-600 dark:text-emerald-400'
			: 'text-rose-600 dark:text-rose-400'

	const bgClassName =
		type === 'rise'
			? 'border-emerald-200 dark:border-emerald-900'
			: 'border-rose-200 dark:border-rose-900'

	const dotActiveColor = type === 'rise' ? 'bg-emerald-500' : 'bg-rose-500'

	const getPositionColor = (position: string) => {
		switch (position) {
			case 'GKP':
				return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
			case 'DEF':
				return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
			case 'MID':
				return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
			case 'FWD':
				return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
			default:
				return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
		}
	}

	const visibleChanges = changes.slice(
		page * PAGE_SIZE,
		page * PAGE_SIZE + PAGE_SIZE
	)

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center gap-2 mb-4">
				{icon}
				<h3 className="text-xl font-bold">{title}</h3>
				{changes.length > 0 && (
					<Badge
						variant="secondary"
						className="ml-auto"
					>
						{changes.length}
					</Badge>
				)}
			</div>
			<div className={`space-y-2 rounded-lg p-3 border ${bgClassName} flex-1`}>
				{changes.length === 0 ? (
					<div className="text-center py-8 text-muted-foreground text-sm">
						No {type === 'rise' ? 'rises' : 'falls'} to display
					</div>
				) : (
					<div
						className="transition-opacity duration-250"
						style={{ opacity: animating ? 0 : 1 }}
					>
						{visibleChanges.map((change, index) => (
							<button
								key={`${page}-${index}`}
								className="w-full flex items-center gap-3 p-3 rounded-lg bg-background/80 hover:bg-background border border-border/50 hover:border-border transition-all text-left group mb-2 last:mb-0"
								onClick={() => console.log(`Clicked on ${change.player}`)}
								aria-label={`View details for ${change.player}`}
							>
								<Badge
									variant="secondary"
									className={`shrink-0 text-xs font-semibold ${getPositionColor(change.position)}`}
								>
									{change.position}
								</Badge>

								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 mb-1">
										<span className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
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
							</button>
						))}
					</div>
				)}
			</div>
			{pages > 1 && (
				<div className="flex justify-center gap-1.5 mt-3">
					{Array.from({ length: pages }).map((_, i) => (
						<button
							key={i}
							onClick={() => {
								if (timerRef.current) clearInterval(timerRef.current)
								setPage(i)
								timerRef.current = setInterval(advance, AUTOPLAY_INTERVAL)
							}}
							className={`h-1.5 rounded-full transition-all duration-300 ${
								i === page
									? `w-4 ${dotActiveColor}`
									: 'w-1.5 bg-muted-foreground/30'
							}`}
							aria-label={`Go to page ${i + 1}`}
						/>
					))}
				</div>
			)}
		</div>
	)
}

export function PriceChangesSectionClient({
	priceRises,
	priceFalls,
	error,
}: {
	priceRises: PriceChange[]
	priceFalls: PriceChange[]
	error?: string | null
}) {
	return (
		<Card className="rounded-none sm:rounded-lg p-4 sm:p-6 lg:p-8">
			{error && (
				<div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
					<p className="text-sm text-destructive">{error}</p>
				</div>
			)}
			<div className="grid md:grid-cols-2 gap-6 lg:gap-8">
				<PriceList
					title="Price Rises"
					changes={priceRises}
					type="rise"
				/>
				<PriceList
					title="Price Falls"
					changes={priceFalls}
					type="fall"
				/>
			</div>
		</Card>
	)
}
