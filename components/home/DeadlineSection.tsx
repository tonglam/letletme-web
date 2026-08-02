'use client'

import { Card } from '@/components/ui/card'
import { CalendarClock } from 'lucide-react'
import { format } from 'date-fns'
import { usePageActive } from '@/hooks/use-page-active'
import { useRouter } from 'next/navigation'
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
			setFormattedDeadline(`Deadline: ${format(deadline, 'EEE d MMM yyyy, HH:mm')}`)
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
	}, [deadline, isPageActive, router])

	if (!nextEventId || !deadlineTime) {
		return (
			<div className="py-10 text-center">
				<div className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-2xl border bg-card p-7 shadow-sm">
					<span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<CalendarClock aria-hidden="true" className="size-5" />
					</span>
					<h2 className="text-2xl font-bold">Gameweek schedule unavailable</h2>
					<p className="text-muted-foreground">
						The live data service is not responding yet. You can still browse the rest of the app.
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="py-10">
			<div className="text-center">
				<p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Next deadline</p>
				<h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Gameweek {nextEventId}</h2>
				{deadlinePassed ? (
					<p className="mt-3 text-lg text-muted-foreground">Gameweek in progress</p>
				) : (
					<>
						<p className="mt-3 text-base text-muted-foreground sm:text-lg">{formattedDeadline}</p>
						<Card className="mt-6 inline-block rounded-2xl p-5 sm:p-7">
							<div className="grid grid-cols-4 gap-3 sm:gap-10">
								{(
									[
										{ value: timeLeft.days, label: 'Days' },
										{ value: timeLeft.hours, label: 'Hours' },
										{ value: timeLeft.minutes, label: 'Minutes' },
										{ value: timeLeft.seconds, label: 'Seconds' },
									] as const
								).map(({ value, label }) => (
									<div
										key={label}
										className="text-center"
									>
										<div className="text-3xl font-bold tabular-nums sm:text-5xl">
											{value}
										</div>
										<div className="mt-1 text-xs text-muted-foreground sm:text-sm">{label}</div>
									</div>
								))}
							</div>
						</Card>
					</>
				)}
			</div>
		</div>
	)
}
