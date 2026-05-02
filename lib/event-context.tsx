'use client'

import { createContext, useContext } from 'react'

interface EventContextValue {
	currentEventId: number | null
	nextEventId: number | null
	deadlineTime: string | null
}

const EventContext = createContext<EventContextValue>({
	currentEventId: null,
	nextEventId: null,
	deadlineTime: null,
})

export function EventProvider({
	children,
	currentEventId,
	nextEventId,
	deadlineTime,
}: {
	children: React.ReactNode
	currentEventId: number | null
	nextEventId: number | null
	deadlineTime: string | null
}) {
	return (
		<EventContext.Provider value={{ currentEventId, nextEventId, deadlineTime }}>
			{children}
		</EventContext.Provider>
	)
}

export function useEvent(): EventContextValue {
	return useContext(EventContext)
}
