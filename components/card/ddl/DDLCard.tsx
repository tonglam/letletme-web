'use client'

import CountDown from '@/components/countDown/CountDown'
import { useEventInfoStore } from '@/hooks/useEventInfoStore'
import { format, parseISO } from 'date-fns'

function DDLCard({
	nextEvent,
	utcDeadline
}: {
	nextEvent: number
	utcDeadline: string
}) {
	const setEventInfo = useEventInfoStore(state => state.setEventInfo)
	setEventInfo(nextEvent, utcDeadline)

	return (
		<div className="grid justify-items-center space-y-4">
			<div className="flex space-x-1.5 text-xl">
				<p className="font-bold">GameWeek {nextEvent}:</p>
				<p>{format(parseISO(utcDeadline), 'E dd MMM HH:mm')}</p>
			</div>
			<div>
				<CountDown utcTime={utcDeadline} />
			</div>
		</div>
	)
}

export { DDLCard }
