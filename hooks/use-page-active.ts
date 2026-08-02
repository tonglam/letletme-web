'use client'

import { useSyncExternalStore } from 'react'

const subscribe = (onStoreChange: () => void) => {
	document.addEventListener('visibilitychange', onStoreChange)
	window.addEventListener('online', onStoreChange)
	window.addEventListener('offline', onStoreChange)

	return () => {
		document.removeEventListener('visibilitychange', onStoreChange)
		window.removeEventListener('online', onStoreChange)
		window.removeEventListener('offline', onStoreChange)
	}
}

const getSnapshot = () =>
	document.visibilityState === 'visible' && window.navigator.onLine

export function usePageActive() {
	return useSyncExternalStore(subscribe, getSnapshot, () => true)
}
