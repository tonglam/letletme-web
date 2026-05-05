'use client'

import { Card } from '@/components/ui/card'
import { format } from 'date-fns'
import { useEffect, useState } from 'react'

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
	const deadline = deadlineTime ? new Date(deadlineTime) : null
	const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 })
	const [formattedDeadline, setFormattedDeadline] = useState('')

	useEffect(() => {
		if (!deadline) {
			const resetTimer = window.setTimeout(() => setFormattedDeadline(''), 0)
			return () => window.clearTimeout(resetTimer)
		}
		const updateTimeLeft = () => setTimeLeft(computeTimeLeft(deadline))
		const initialTimer = window.setTimeout(() => {
			setFormattedDeadline(`Deadline: ${format(deadline, 'EEE d MMM yyyy, HH:mm')}`)
			updateTimeLeft()
		}, 0)
		const timer = setInterval(() => setTimeLeft(computeTimeLeft(deadline)), 1000)
		return () => {
			window.clearTimeout(initialTimer)
			clearInterval(timer)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [deadlineTime]) // depend on the string prop so the timer restarts if deadline changes

	return (
		<div className="py-12 mb-0">
			<div className="text-center">
				<h1 className="text-4xl font-bold mb-4">
					{nextEventId ? `Gameweek ${nextEventId}` : 'Gameweek'}
				</h1>
				<p className="text-xl text-muted-foreground mb-8">{formattedDeadline}</p>
				<Card className="inline-block p-6 md:p-8 lg:p-10">
					<div className="grid grid-cols-4 gap-4 md:gap-12 lg:gap-16">
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
								<div className="text-4xl font-bold mb-1 md:text-5xl lg:text-6xl">
									{value}
								</div>
								<div className="text-sm text-muted-foreground">{label}</div>
							</div>
						))}
					</div>
				</Card>
			</div>
		</div>
	)
}
