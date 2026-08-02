'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => undefined
const getClientSnapshot = () => true
const getServerSnapshot = () => false

/**
 * Reports whether React has attached client-side behavior to this island.
 * The server and initial hydration render stay aligned, then React performs
 * one synchronous client update without an effect-driven loading flash.
 */
export function useHydrated() {
	return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
}
