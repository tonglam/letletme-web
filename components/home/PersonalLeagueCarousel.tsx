'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import type { ReactNode, TouchEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

const AUTO_ADVANCE_MS = 7_000
const SWIPE_THRESHOLD_PX = 40

export type PersonalLeagueCarouselSlide = {
	id: string
	label: string
	count: number
	content: ReactNode
	fullContent?: ReactNode
	viewAllLabel?: string
}

export type PersonalLeagueCarouselLabels = {
	pagerLabel: string
	previousPage: string
	nextPage: string
	pause: string
	resume: string
}

export function PersonalLeagueCarousel({
	slides,
	labels
}: {
	slides: PersonalLeagueCarouselSlide[]
	labels: PersonalLeagueCarouselLabels
}) {
	const availableSlideIds = useMemo(
		() => slides.filter(slide => slide.count > 0).map(slide => slide.id),
		[slides]
	)
	const firstAvailableSlideId = availableSlideIds[0] ?? slides[0]?.id ?? ''
	const [activeSlideId, setActiveSlideId] = useState(firstAvailableSlideId)
	const [isManuallyPaused, setIsManuallyPaused] = useState(false)
	const [isInteractionPaused, setIsInteractionPaused] = useState(false)
	const [isFullListOpen, setIsFullListOpen] = useState(false)
	const touchStartX = useRef<number | null>(null)

	const activeSlideIndex = Math.max(
		0,
		slides.findIndex(slide => slide.id === activeSlideId)
	)
	const activeSlide = slides[activeSlideIndex] ?? slides[0]
	const isAutoPaused = isManuallyPaused || isInteractionPaused || isFullListOpen
	const tabGridClass =
		slides.length === 1
			? 'grid-cols-1'
			: slides.length === 2
				? 'grid-cols-2'
				: 'grid-cols-3'

	useEffect(() => {
		if (
			availableSlideIds.length < 2 ||
			isAutoPaused ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
			return
		}

		const interval = window.setInterval(() => {
			setActiveSlideId(currentSlideId => {
				const currentIndex = availableSlideIds.indexOf(currentSlideId)
				const nextIndex =
					currentIndex < 0 ? 0 : (currentIndex + 1) % availableSlideIds.length
				return availableSlideIds[nextIndex]
			})
		}, AUTO_ADVANCE_MS)

		return () => window.clearInterval(interval)
	}, [availableSlideIds, isAutoPaused])

	useEffect(() => {
		if (activeSlideId && slides.some(slide => slide.id === activeSlideId)) {
			return
		}
		setActiveSlideId(firstAvailableSlideId)
	}, [activeSlideId, firstAvailableSlideId, slides])

	if (!activeSlide) return null

	const move = (direction: -1 | 1) => {
		if (availableSlideIds.length < 2) return
		const currentIndex = availableSlideIds.indexOf(activeSlide.id)
		const safeIndex = currentIndex < 0 ? 0 : currentIndex
		const nextIndex =
			(safeIndex + direction + availableSlideIds.length) %
			availableSlideIds.length
		setActiveSlideId(availableSlideIds[nextIndex])
	}

	const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
		touchStartX.current = event.touches[0]?.clientX ?? null
		setIsInteractionPaused(true)
	}

	const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
		const startX = touchStartX.current
		touchStartX.current = null
		if (startX !== null) {
			const endX = event.changedTouches[0]?.clientX ?? startX
			const deltaX = endX - startX
			if (Math.abs(deltaX) >= SWIPE_THRESHOLD_PX) {
				move(deltaX < 0 ? 1 : -1)
			}
		}
		setIsInteractionPaused(false)
	}

	return (
		<div
			data-home-personal-league-carousel="true"
			onMouseEnter={() => setIsInteractionPaused(true)}
			onMouseLeave={() => setIsInteractionPaused(false)}
			onFocusCapture={() => setIsInteractionPaused(true)}
			onBlurCapture={event => {
				if (
					!event.relatedTarget ||
					!event.currentTarget.contains(event.relatedTarget as Node)
				) {
					setIsInteractionPaused(false)
				}
			}}
			onTouchStart={handleTouchStart}
			onTouchEnd={handleTouchEnd}
			onTouchCancel={() => {
				touchStartX.current = null
				setIsInteractionPaused(false)
			}}
		>
			<div className="mb-3 flex items-center gap-2">
				<div
					role="tablist"
					aria-label={labels.pagerLabel}
					className={cn(
						'grid min-w-0 flex-1 rounded-lg border border-border/70 bg-muted/20 p-1',
						tabGridClass
					)}
				>
					{slides.map((slide, index) => {
						const isActive = slide.id === activeSlide.id
						const isDisabled = slide.count === 0
						return (
							<button
								key={slide.id}
								type="button"
								role="tab"
								id={`home-personal-league-${slide.id}-tab`}
								aria-selected={isActive}
								aria-controls={`home-personal-league-${slide.id}`}
								aria-setsize={slides.length}
								aria-posinset={index + 1}
								disabled={isDisabled}
								onClick={() => setActiveSlideId(slide.id)}
								className={cn(
									'flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors motion-reduce:transition-none',
									isActive
										? 'bg-background text-foreground shadow-sm'
										: 'text-muted-foreground hover:text-foreground',
									isDisabled && 'cursor-not-allowed opacity-45'
								)}
							>
								<span className="truncate">{slide.label}</span>
								<span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
									{slide.count}
								</span>
							</button>
						)
					})}
				</div>
				<div className="flex shrink-0 gap-1">
					<Button
						variant="outline"
						size="icon"
						type="button"
						disabled={availableSlideIds.length < 2}
						aria-label={labels.previousPage}
						onClick={() => move(-1)}
						className="size-9"
					>
						<ChevronLeft aria-hidden="true" />
					</Button>
					<Button
						variant="outline"
						size="icon"
						type="button"
						disabled={availableSlideIds.length < 2}
						aria-label={labels.nextPage}
						onClick={() => move(1)}
						className="size-9"
					>
						<ChevronRight aria-hidden="true" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						type="button"
						aria-pressed={isManuallyPaused}
						aria-label={isManuallyPaused ? labels.resume : labels.pause}
						onClick={() => setIsManuallyPaused(value => !value)}
						className="size-9 text-muted-foreground hover:text-foreground"
					>
						{isManuallyPaused ? (
							<Play aria-hidden="true" />
						) : (
							<Pause aria-hidden="true" />
						)}
					</Button>
				</div>
			</div>

			<div
				className="overflow-hidden"
				aria-live="polite"
				data-home-personal-league-slide={activeSlide.id}
			>
				<div
					className="flex w-full motion-reduce:transition-none"
					style={{
						transform: `translateX(-${activeSlideIndex * 100}%)`,
						transition: 'transform 280ms ease-out'
					}}
				>
					{slides.map(slide => (
						<section
							key={slide.id}
							data-home-league-group={slide.id}
							id={`home-personal-league-${slide.id}`}
							role="tabpanel"
							aria-labelledby={`home-personal-league-${slide.id}-tab`}
							aria-hidden={slide.id !== activeSlide.id}
							inert={slide.id !== activeSlide.id}
							className="min-w-full"
						>
							{slide.content}
							{slide.viewAllLabel && slide.fullContent ? (
								<div className="mt-2 flex justify-end border-t border-border/45 pt-2">
									<Button
										variant="ghost"
										size="sm"
										type="button"
										onClick={() => {
											setActiveSlideId(slide.id)
											setIsFullListOpen(true)
										}}
										className="h-8 gap-1 px-2 text-xs font-semibold text-primary-ink"
									>
										{slide.viewAllLabel}
										<ChevronRight
											aria-hidden="true"
											className="size-3.5"
										/>
									</Button>
								</div>
							) : null}
						</section>
					))}
				</div>
			</div>

			{activeSlide.fullContent ? (
				<Dialog
					open={isFullListOpen}
					onOpenChange={setIsFullListOpen}
				>
					<DialogContent className="max-h-[85vh] overflow-y-auto p-4 sm:max-w-xl sm:p-6">
						<DialogTitle className="font-display text-base font-bold uppercase tracking-wide">
							{activeSlide.label}
						</DialogTitle>
						<div className="mt-3">{activeSlide.fullContent}</div>
					</DialogContent>
				</Dialog>
			) : null}
		</div>
	)
}
