'use client'

import { GameweekBadge } from '@/components/stats/GameweekBadge'
import { CalendarClock } from 'lucide-react'
import { usePageActive } from '@/hooks/use-page-active'
import { useRouter } from '@/i18n/navigation'
import {
	computeTimeLeft,
	homeDeadlineRefreshDelayMs,
	type TimeLeft
} from '@/lib/home-deadline'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'

interface DeadlineSectionProps {
	nextEventId: number | null
	deadlineTime: string | null
	initialTimeLeft: TimeLeft
	bootstrapFailed: boolean
}

type DeadlineSchedule = {
	nextEventId: number
	deadlineTime: string
	initialTimeLeft: TimeLeft
}

export function DeadlineSection({
	nextEventId,
	deadlineTime,
	initialTimeLeft,
	bootstrapFailed
}: DeadlineSectionProps) {
	const locale = useLocale()
	const t = useTranslations('Home')
	const incomingSchedule = useMemo<DeadlineSchedule | null>(
		() =>
			nextEventId && deadlineTime
				? { nextEventId, deadlineTime, initialTimeLeft }
				: null,
		[deadlineTime, initialTimeLeft, nextEventId]
	)
	const [lastValidSchedule, setLastValidSchedule] =
		useState<DeadlineSchedule | null>(incomingSchedule)
	const effectiveSchedule =
		incomingSchedule ?? (bootstrapFailed ? lastValidSchedule : null)
	const effectiveDeadlineTime = effectiveSchedule?.deadlineTime ?? null
	const effectiveNextEventId = effectiveSchedule?.nextEventId ?? null
	const deadline = useMemo(
		() =>
			effectiveDeadlineTime ? new Date(effectiveDeadlineTime) : null,
		[effectiveDeadlineTime]
	)
	const [timeLeft, setTimeLeft] = useState<TimeLeft>(
		effectiveSchedule?.initialTimeLeft ?? initialTimeLeft
	)
	const [formattedDeadlineDate, setFormattedDeadlineDate] = useState('')
	const [deadlinePassed, setDeadlinePassed] = useState(false)
	const router = useRouter()
	const routerRef = useRef(router)
	const refreshCount = useRef(0)
	const refreshDeadline = useRef<string | null>(effectiveDeadlineTime)
	const isPageActive = usePageActive()

	useEffect(() => {
		if (incomingSchedule) {
			setLastValidSchedule(current =>
				current === incomingSchedule ? current : incomingSchedule
			)
		} else if (!bootstrapFailed) {
			setLastValidSchedule(null)
		}
	}, [bootstrapFailed, incomingSchedule])

	useEffect(() => {
		routerRef.current = router
	}, [router])

	useEffect(() => {
		if (refreshDeadline.current !== effectiveDeadlineTime) {
			refreshDeadline.current = effectiveDeadlineTime
			refreshCount.current = 0
		}
		if (!deadline) {
			const resetTimer = window.setTimeout(() => {
				setFormattedDeadlineDate('')
				setDeadlinePassed(false)
			}, 0)
			return () => window.clearTimeout(resetTimer)
		}

		const updateTimeLeft = () => {
			const isPast = deadline.getTime() <= Date.now()
			setDeadlinePassed(isPast)
			setTimeLeft(computeTimeLeft(deadline.getTime()))
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
			setFormattedDeadlineDate(formatted)
			updateTimeLeft()
		}, 0)
		const tickTimer = isPageActive ? setInterval(updateTimeLeft, 1000) : undefined

		// The revision publisher can advance after the nominal deadline. Keep checking
		// while the page is active, with an interval capped at five minutes, so a slow
		// publication cannot leave the page permanently pinned to the expired event.
		let expireTimer: number | undefined
		let refreshTimer: number | undefined

		const startRefreshing = () => {
			const refresh = () => {
				refreshCount.current += 1
				routerRef.current.refresh()
				refreshTimer = window.setTimeout(
					refresh,
					homeDeadlineRefreshDelayMs(refreshCount.current)
				)
			}
			refresh()
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
			if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
		}
	}, [deadline, effectiveDeadlineTime, isPageActive, locale])

	if (!effectiveNextEventId || !effectiveDeadlineTime) {
		return (
			<div className="scoreboard texture-grain rounded-xl p-6 sm:p-7">
				<p className="chyron text-electric">{t('nextDeadline')}</p>
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
				<p className="chyron text-electric">{t('nextDeadline')}</p>
				<span className="inline-flex items-center gap-2">
					<span className="live-dot" aria-hidden="true" />
					<GameweekBadge gameweek={effectiveNextEventId} size="sm" />
				</span>
			</div>

			<h2 className="mt-4 font-display text-3xl font-bold uppercase leading-none tracking-wide sm:text-4xl">
				{t('gameweek', { number: effectiveNextEventId })}
			</h2>

			{deadlinePassed ? (
				<div className="mt-6 flex items-center gap-3 rounded-lg border border-pink/40 bg-pink/10 px-4 py-4">
					<span className="rounded-sm bg-pink px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-caps-wide text-pink-950">
						{t('liveTag')}
					</span>
					<p className="font-display text-lg font-semibold uppercase tracking-wide">
						{t('inProgress')}
					</p>
				</div>
			) : (
				<>
					<div className="mt-6 grid grid-cols-4 divide-x divide-fascia-foreground/10 overflow-hidden rounded-lg border border-fascia-foreground/10 bg-plum/30">
						{(
							[
								{ value: timeLeft.days, label: t('days') },
								{ value: timeLeft.hours, label: t('hours') },
								{ value: timeLeft.minutes, label: t('minutes') },
								{ value: timeLeft.seconds, label: t('seconds') },
							] as const
						).map(({ value, label }) => (
							<div key={label} className="px-1 py-3 text-center sm:py-4">
								<div className="font-mono text-3xl font-semibold tabular-nums text-electric text-glow-electric sm:text-4xl">
									{String(value).padStart(2, '0')}
								</div>
								<div className="mt-1 eyebrow text-fascia-foreground/50">
									{label}
								</div>
							</div>
						))}
					</div>
					<p className="mt-4 flex items-center gap-2 text-xs text-fascia-foreground/60">
						<CalendarClock aria-hidden="true" className="size-3.5 shrink-0 text-electric" />
						{formattedDeadlineDate
							? t('deadline', { date: formattedDeadlineDate })
							: null}
					</p>
				</>
			)}
		</div>
	)
}
