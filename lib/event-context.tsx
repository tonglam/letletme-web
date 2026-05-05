'use client'

import { createContext, useContext } from 'react'

interface EventContextValue {
	currentEventId: number | null
	nextEventId: number | null
	deadlineTime: string | null
	seasonKey: number
	entryId: number | null
}

const EventContext = createContext<EventContextValue>({
	currentEventId: null,
	nextEventId: null,
	deadlineTime: null,
	seasonKey: 0,
	entryId: null,
})

export function EventProvider({
	children,
	currentEventId,
	nextEventId,
	deadlineTime,
	seasonKey,
	entryId,
}: {
	children: React.ReactNode
	currentEventId: number | null
	nextEventId: number | null
	deadlineTime: string | null
	seasonKey: number
	entryId: number | null
}) {
	return (
		<EventContext.Provider value={{ currentEventId, nextEventId, deadlineTime, seasonKey, entryId }}>
			{children}
		</EventContext.Provider>
	)
}

export function useEvent(): EventContextValue {
	return useContext(EventContext)
}
