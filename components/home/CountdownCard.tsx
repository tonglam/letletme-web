'use client'

import { cn } from '@/lib/utils'
import { computeTimeLeft, type TimeLeft } from '@/lib/home-deadline'
import { CalendarClock } from 'lucide-react'
import { useLocale } from 'next-intl'
import { forwardRef, type ReactNode, useEffect, useMemo, useState } from 'react'

type CountdownVariant = 'dark' | 'light'

export type CountdownCardProps = {
	eyebrow: ReactNode
	title: ReactNode
	deadlineTime: string | null
	initialTimeLeft: TimeLeft
	deadlinePrefix: ReactNode
	noDeadlineLabel: ReactNode
	unitLabels: {
		days: ReactNode
		hours: ReactNode
		minutes: ReactNode
		seconds: ReactNode
	}
	expiredBadge?: ReactNode
	expiredLabel?: ReactNode
	headerAction?: ReactNode
	variant?: CountdownVariant
	className?: string
}

const ZERO_TIME_LEFT: TimeLeft = {
	days: 0,
	hours: 0,
	minutes: 0,
	seconds: 0
}

function formatLocalDeadline(value: string, locale: string): string {
	const timestamp = Date.parse(value)
	if (!Number.isFinite(timestamp)) return ''

	return new Intl.DateTimeFormat(locale, {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZoneName: 'short'
	}).format(new Date(timestamp))
}

export const CountdownCard = forwardRef<HTMLDivElement, CountdownCardProps>(
	function CountdownCard(
		{
			eyebrow,
			title,
			deadlineTime,
			initialTimeLeft,
			deadlinePrefix,
			noDeadlineLabel,
			unitLabels,
			expiredBadge,
			expiredLabel,
			headerAction,
			variant = 'dark',
			className
		},
		ref
	) {
		const locale = useLocale()
		const deadlineMs = useMemo(
			() => (deadlineTime ? Date.parse(deadlineTime) : NaN),
			[deadlineTime]
		)
		const hasDeadline = Number.isFinite(deadlineMs)
		const [timeLeft, setTimeLeft] = useState<TimeLeft>(
			initialTimeLeft ?? ZERO_TIME_LEFT
		)
		const [deadlinePassed, setDeadlinePassed] = useState(false)
		const [formattedDeadline, setFormattedDeadline] = useState('')
		const dark = variant === 'dark'

		useEffect(() => {
			if (!hasDeadline) {
				setTimeLeft(ZERO_TIME_LEFT)
				setDeadlinePassed(false)
				setFormattedDeadline('')
				return
			}

			const update = () => {
				const isPast = deadlineMs <= Date.now()
				setDeadlinePassed(isPast)
				setTimeLeft(computeTimeLeft(deadlineMs))
			}

			update()
			setFormattedDeadline(formatLocalDeadline(deadlineTime!, locale))
			const timer = window.setInterval(update, 1_000)
			return () => window.clearInterval(timer)
		}, [deadlineMs, deadlineTime, hasDeadline, locale])

		const units = [
			{ key: 'days', value: timeLeft.days, label: unitLabels.days },
			{ key: 'hours', value: timeLeft.hours, label: unitLabels.hours },
			{ key: 'minutes', value: timeLeft.minutes, label: unitLabels.minutes },
			{ key: 'seconds', value: timeLeft.seconds, label: unitLabels.seconds }
		] as const

		return (
			<div
				ref={ref}
				data-share-preserve-width="true"
				data-countdown-card={variant}
				className={cn(
					dark
						? 'scoreboard texture-grain rounded-2xl p-5 sm:p-7'
						: 'overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.06] p-4 shadow-sm sm:p-5',
					className
				)}
			>
				<div className="flex items-start justify-between gap-4">
					<div className="min-w-0">
						<p
							className={cn(
								'chyron',
								dark ? 'text-electric' : 'text-primary-ink'
							)}
						>
							{eyebrow}
						</p>
						<h2
							className={cn(
								dark
									? 'mt-3 font-display text-3xl font-bold uppercase leading-none tracking-wide text-fascia-foreground sm:text-4xl'
									: 'mt-2 font-display text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl'
							)}
						>
							{title}
						</h2>
					</div>
					{headerAction ? (
						<div className="flex shrink-0 items-center gap-2">
							{headerAction}
						</div>
					) : null}
				</div>

				{!hasDeadline ? (
					<p
						className={cn(
							'mt-5 rounded-xl border border-dashed px-4 py-3 text-sm',
							dark ? 'text-fascia-foreground/60' : 'text-muted-foreground'
						)}
					>
						{noDeadlineLabel}
					</p>
				) : deadlinePassed ? (
					<div
						className={cn(
							'mt-5 flex items-center gap-3 rounded-xl border px-4 py-3.5',
							dark
								? 'border-pink/40 bg-pink/10'
								: 'border-warning/40 bg-warning/10'
						)}
					>
						<span
							className={cn(
								'flex size-9 shrink-0 items-center justify-center rounded-lg',
								dark
									? 'bg-pink/20 text-pink'
									: 'bg-warning/20 text-warning-foreground'
							)}
						>
							<CalendarClock
								aria-hidden="true"
								className="size-5"
							/>
						</span>
						<div className="min-w-0">
							{expiredBadge ? (
								<span
									className={cn(
										'inline-flex rounded-sm px-2 py-0.5 font-display text-xs font-bold uppercase tracking-caps-wide',
										dark
											? 'bg-pink text-pink-950'
											: 'bg-warning/20 text-warning-foreground'
									)}
								>
									{expiredBadge}
								</span>
							) : null}
							<p
								className={cn(
									'mt-1 font-display text-base font-semibold tracking-wide sm:text-lg',
									dark ? 'text-fascia-foreground' : 'text-foreground'
								)}
							>
								{expiredLabel ?? noDeadlineLabel}
							</p>
						</div>
					</div>
				) : (
					<div
						className={cn(
							'mt-5 grid grid-cols-4 divide-x overflow-hidden rounded-xl',
							dark
								? 'divide-fascia-foreground/10 border border-fascia-foreground/10 bg-plum/30'
								: 'divide-border/70 border border-primary/15 bg-background/75 shadow-inner'
						)}
						role="timer"
						aria-label={String(title)}
					>
						{units.map(({ key, value, label }) => (
							<div
								key={key}
								className={cn(
									'relative px-1 py-3.5 text-center sm:py-4',
									!dark && 'first:bg-primary/[0.035] last:bg-primary/[0.035]'
								)}
							>
								<div
									className={cn(
										'font-display text-3xl font-bold tabular-nums sm:text-4xl',
										dark
											? 'text-electric text-glow-electric'
											: 'text-primary-ink'
									)}
								>
									{String(value).padStart(2, '0')}
								</div>
								<div
									className={cn(
										'mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em]',
										dark ? 'text-fascia-foreground/50' : 'text-muted-foreground'
									)}
								>
									{label}
								</div>
							</div>
						))}
					</div>
				)}

				{formattedDeadline ? (
					<div
						className={cn(
							'mt-4 flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs',
							dark
								? 'border-fascia-foreground/10 bg-plum/20 text-fascia-foreground/60'
								: 'border-primary/15 bg-card/70 text-muted-foreground'
						)}
					>
						<span
							className={cn(
								'flex size-7 shrink-0 items-center justify-center rounded-md',
								dark
									? 'bg-electric/10 text-electric'
									: 'bg-primary/10 text-primary-ink'
							)}
						>
							<CalendarClock
								aria-hidden="true"
								className="size-4"
							/>
						</span>
						<span className="min-w-0 leading-5">
							<span className="mr-1 font-semibold">{deadlinePrefix}</span>
							<time className="whitespace-nowrap">{formattedDeadline}</time>
						</span>
					</div>
				) : null}
			</div>
		)
	}
)
