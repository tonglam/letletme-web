import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type EventInfo = {
	event: number
	nextEvent: number
	utcDeadline: string
}

export type EventInfoState = {
	eventInfo: EventInfo
	setEventInfo: (nextEvent: number, utcDeadline: string) => void
}

export const useEventInfoStore = create<EventInfoState>()(
	persist(
		set => ({
			eventInfo: { event: 0, nextEvent: 0, utcDeadline: '' },
			setEventInfo: (nextEvent: number, utcDeadline: string) =>
				set(() => ({
					eventInfo: {
						event: nextEvent - 1,
						nextEvent: nextEvent,
						utcDeadline: utcDeadline
					}
				}))
		}),
		{ name: 'event-info', skipHydration: true }
	)
)
