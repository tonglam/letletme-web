'use client'

import { CalendarClock } from 'lucide-react'
import { usePageActive } from '@/hooks/use-page-active'
import { useRouter } from '@/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'

interface TimeLeft {
	days: number
	hours: number
	minutes: number
	seconds: number
}

function computeTimeLeft(deadline: Date | null): TimeLeft {
	if (!deadline) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
	const diff = deadline.getTime() - Date.now()
	if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
	return {
		days: Math.floor(diff / (1000 * 60 * 60 * 24)),
		hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
		minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
		seconds: Math.floor((diff % (1000 * 60)) / 1000),
	}
}

interface DeadlineSectionProps {
	nextEventId: number | null
	deadlineTime: string | null
}

export function DeadlineSection({ nextEventId, deadlineTime }: DeadlineSectionProps) {
	const locale = useLocale()
	const t = useTranslations('Home')
	const deadline = useMemo(() => (deadlineTime ? new Date(deadlineTime) : null), [deadlineTime])
	const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 })
	const [formattedDeadline, setFormattedDeadline] = useState('')
	const [deadlinePassed, setDeadlinePassed] = useState(false)
	const router = useRouter()
	const isPageActive = usePageActive()

	useEffect(() => {
		if (!deadline) {
			const resetTimer = window.setTimeout(() => {
				setFormattedDeadline('')
				setDeadlinePassed(false)
			}, 0)
			return () => window.clearTimeout(resetTimer)
		}

		const updateTimeLeft = () => {
			const isPast = deadline.getTime() <= Date.now()
			setDeadlinePassed(isPast)
			setTimeLeft(computeTimeLeft(deadline))
		}

		const initialTimer = window.setTimeout(() => {
			const formatted = new Intl.DateTimeFormat(locale, {
				weekday: 'short',
				day: 'numeric',
				month: 'short',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
			}).format(deadline)
			setFormattedDeadline(t('deadline', { date: formatted }))
			updateTimeLeft()
		}, 0)
		const tickTimer = isPageActive ? setInterval(updateTimeLeft, 1000) : undefined

		// When deadline has passed, the backend's event cache will eventually expire and
		// return the next GW. Poll via router.refresh() so the UI updates without a manual
		// reload. 30 s interval is short enough to feel responsive without hammering the server.
		let expireTimer: number | undefined
		let refreshTimer: ReturnType<typeof setInterval> | undefined

		const startRefreshing = () => {
			router.refresh()
			refreshTimer = setInterval(() => router.refresh(), 30_000)
		}

		const msUntilDeadline = deadline.getTime() - Date.now()
		if (isPageActive) {
			if (msUntilDeadline <= 0) {
				startRefreshing()
			} else {
				expireTimer = window.setTimeout(startRefreshing, msUntilDeadline + 500)
			}
		}

		return () => {
			window.clearTimeout(initialTimer)
			if (tickTimer !== undefined) clearInterval(tickTimer)
			if (expireTimer !== undefined) window.clearTimeout(expireTimer)
			if (refreshTimer !== undefined) clearInterval(refreshTimer)
		}
	}, [deadline, isPageActive, locale, router, t])

	if (!nextEventId || !deadlineTime) {
		return (
			<div className="scoreboard texture-grain rounded-xl p-6 sm:p-7">
				<p className="chyron !text-electric">{t('nextDeadline')}</p>
				<h2 className="mt-3 font-display text-2xl font-bold uppercase tracking-wide">
					{t('scheduleUnavailable')}
				</h2>
				<p className="mt-2 text-sm text-fascia-foreground/60">
					{t('scheduleUnavailableDescription')}
				</p>
			</div>
		)
	}

	return (
		<div className="scoreboard texture-grain rounded-xl p-6 sm:p-7">
			<div className="flex items-center justify-between gap-3">
				<p className="chyron !text-electric">{t('nextDeadline')}</p>
				<span className="flex items-center gap-2 rounded-sm border border-electric/30 bg-electric/10 px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-electric">
					<span className="live-dot" aria-hidden="true" />
					GW{nextEventId}
				</span>
			</div>

			<h2 className="mt-4 font-display text-3xl font-bold uppercase leading-none tracking-wide sm:text-4xl">
				{t('gameweek', { number: nextEventId })}
			</h2>

			{deadlinePassed ? (
				<div className="mt-6 flex items-center gap-3 rounded-lg border border-pink/40 bg-pink/10 px-4 py-4">
					<span className="rounded-sm bg-pink px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-[0.2em] text-white">
						{t('liveTag')}
					</span>
					<p className="font-display text-lg font-semibold uppercase tracking-wide">
						{t('inProgress')}
					</p>
				</div>
			) : (
				<>
					<div className="mt-6 grid grid-cols-4 divide-x divide-white/10 overflow-hidden rounded-lg border border-white/10 bg-black/25">
						{(
							[
								{ value: timeLeft.days, label: t('days') },
								{ value: timeLeft.hours, label: t('hours') },
								{ value: timeLeft.minutes, label: t('minutes') },
								{ value: timeLeft.seconds, label: t('seconds') },
							] as const
						).map(({ value, label }) => (
							<div key={label} className="px-1 py-3 text-center sm:py-4">
								<div className="font-mono text-3xl font-semibold tabular-nums text-electric [text-shadow:0_0_18px_hsl(var(--electric)/0.45)] sm:text-4xl">
									{String(value).padStart(2, '0')}
								</div>
								<div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-fascia-foreground/50">
									{label}
								</div>
							</div>
						))}
					</div>
					<p className="mt-4 flex items-center gap-2 text-xs text-fascia-foreground/60">
						<CalendarClock aria-hidden="true" className="size-3.5 shrink-0 text-electric" />
						{formattedDeadline}
					</p>
				</>
			)}
		</div>
	)
}
