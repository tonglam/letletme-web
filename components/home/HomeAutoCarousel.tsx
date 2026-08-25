'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import type { KeyboardEvent, ReactNode, TouchEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

const AUTO_ADVANCE_MS = 7_000
const SWIPE_THRESHOLD_PX = 40

export type HomeAutoCarouselSlide = {
	id: string
	label: string
	count?: number
	enabled?: boolean
	content: ReactNode
	fullContent?: ReactNode
	viewAllLabel?: string
}

export type HomeAutoCarouselLabels = {
	pagerLabel: string
	previousPage: string
	nextPage: string
	pause: string
	resume: string
}

type HomeAutoCarouselProps = {
	slides: HomeAutoCarouselSlide[]
	labels: HomeAutoCarouselLabels
	renderHeader?: (slide: HomeAutoCarouselSlide) => ReactNode
	renderAction?: (slide: HomeAutoCarouselSlide) => ReactNode
	className?: string
	dataAttribute?: string
}

export function HomeAutoCarousel({
	slides,
	labels,
	renderHeader,
	renderAction,
	className,
	dataAttribute = 'home-auto-carousel'
}: HomeAutoCarouselProps) {
	const visibleSlides = useMemo(
		() => slides.filter(slide => slide.enabled !== false),
		[slides]
	)
	const firstSlideId = visibleSlides[0]?.id ?? ''
	const [activeSlideId, setActiveSlideId] = useState(firstSlideId)
	const [isManuallyPaused, setIsManuallyPaused] = useState(false)
	const [isInteractionPaused, setIsInteractionPaused] = useState(false)
	const [isReducedMotion, setIsReducedMotion] = useState(false)
	const [isFullListOpen, setIsFullListOpen] = useState(false)
	const touchStartX = useRef<number | null>(null)
	const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

	const activeSlideIndex = Math.max(
		0,
		visibleSlides.findIndex(slide => slide.id === activeSlideId)
	)
	const activeSlide = visibleSlides[activeSlideIndex] ?? visibleSlides[0]
	const isAutoPaused = isManuallyPaused || isInteractionPaused || isFullListOpen

	useEffect(() => {
		const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
		const updatePreference = () => setIsReducedMotion(mediaQuery.matches)
		updatePreference()
		mediaQuery.addEventListener?.('change', updatePreference)
		return () => mediaQuery.removeEventListener?.('change', updatePreference)
	}, [])

	useEffect(() => {
		if (visibleSlides.length < 2 || isAutoPaused || isReducedMotion) {
			return
		}

		const interval = window.setInterval(() => {
			setActiveSlideId(currentSlideId => {
				const currentIndex = visibleSlides.findIndex(
					slide => slide.id === currentSlideId
				)
				const nextIndex =
					currentIndex < 0 ? 0 : (currentIndex + 1) % visibleSlides.length
				return visibleSlides[nextIndex]?.id ?? firstSlideId
			})
		}, AUTO_ADVANCE_MS)

		return () => window.clearInterval(interval)
	}, [firstSlideId, isAutoPaused, isReducedMotion, visibleSlides])

	useEffect(() => {
		if (
			activeSlideId &&
			visibleSlides.some(slide => slide.id === activeSlideId)
		) {
			return
		}
		setActiveSlideId(firstSlideId)
	}, [activeSlideId, firstSlideId, visibleSlides])

	if (!activeSlide) return null

	const move = (direction: -1 | 1) => {
		if (visibleSlides.length < 2) return
		const currentIndex = visibleSlides.findIndex(
			slide => slide.id === activeSlide.id
		)
		const safeIndex = currentIndex < 0 ? 0 : currentIndex
		const nextIndex =
			(safeIndex + direction + visibleSlides.length) % visibleSlides.length
		setActiveSlideId(visibleSlides[nextIndex]?.id ?? firstSlideId)
	}

	const focusSlide = (slideId: string) => {
		setActiveSlideId(slideId)
		window.requestAnimationFrame(() => tabRefs.current[slideId]?.focus())
	}

	const handleTabKeyDown = (
		event: KeyboardEvent<HTMLButtonElement>,
		slideId: string
	) => {
		const currentIndex = visibleSlides.findIndex(slide => slide.id === slideId)
		if (currentIndex < 0) return
		let nextIndex: number | null = null
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
			nextIndex = (currentIndex + 1) % visibleSlides.length
		} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			nextIndex =
				(currentIndex - 1 + visibleSlides.length) % visibleSlides.length
		} else if (event.key === 'Home') {
			nextIndex = 0
		} else if (event.key === 'End') {
			nextIndex = visibleSlides.length - 1
		}
		if (nextIndex === null) return
		event.preventDefault()
		const nextSlide = visibleSlides[nextIndex]
		if (nextSlide) focusSlide(nextSlide.id)
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
			data-home-carousel={dataAttribute}
			className={className}
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
			{renderHeader || renderAction ? (
				<div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					{renderHeader ? <div>{renderHeader(activeSlide)}</div> : <div />}
					{renderAction ? renderAction(activeSlide) : null}
				</div>
			) : null}

			<div className="mb-5 flex flex-wrap items-center gap-3">
				<div
					role="tablist"
					aria-label={labels.pagerLabel}
					className={cn(
						'grid min-w-0 flex-1 rounded-lg border border-border/70 bg-muted/20 p-1',
						visibleSlides.length === 1
							? 'grid-cols-1'
							: visibleSlides.length === 2
								? 'grid-cols-2'
								: 'grid-cols-3'
					)}
				>
					{visibleSlides.map((slide, index) => {
						const isActive = slide.id === activeSlide.id
						return (
							<button
								key={slide.id}
								ref={node => {
									tabRefs.current[slide.id] = node
								}}
								type="button"
								role="tab"
								id={`${dataAttribute}-${slide.id}-tab`}
								aria-selected={isActive}
								aria-controls={`${dataAttribute}-${slide.id}`}
								aria-setsize={visibleSlides.length}
								aria-posinset={index + 1}
								tabIndex={isActive ? 0 : -1}
								onKeyDown={event => handleTabKeyDown(event, slide.id)}
								onClick={() => setActiveSlideId(slide.id)}
								className={cn(
									'flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors motion-reduce:transition-none',
									isActive
										? 'bg-background text-foreground shadow-sm'
										: 'text-muted-foreground hover:text-foreground'
								)}
							>
								<span className="truncate">{slide.label}</span>
								{slide.count !== undefined ? (
									<span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
										{slide.count}
									</span>
								) : null}
							</button>
						)
					})}
				</div>
				<div className="flex shrink-0 gap-1">
					<Button
						variant="outline"
						size="icon"
						type="button"
						disabled={visibleSlides.length < 2}
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
						disabled={visibleSlides.length < 2}
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
						disabled={visibleSlides.length < 2}
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

			<div className="overflow-hidden">
				<div
					className="flex w-full motion-reduce:transition-none"
					style={{
						transform: `translateX(-${activeSlideIndex * 100}%)`,
						transition: isReducedMotion ? undefined : 'transform 280ms ease-out'
					}}
				>
					{visibleSlides.map(slide => {
						const isInactive = slide.id !== activeSlide.id
						return (
							<section
								key={slide.id}
								id={`${dataAttribute}-${slide.id}`}
								role="tabpanel"
								aria-labelledby={`${dataAttribute}-${slide.id}-tab`}
								aria-hidden={isInactive}
								inert={isInactive}
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
						)
					})}
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
