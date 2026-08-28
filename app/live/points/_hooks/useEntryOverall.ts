'use client'

import {
	GET_ENTRY,
	type EntryLookupStatus,
	type EntryOverallSnapshot,
	type EntryPersistenceState,
	type EntrySummaryResponse
} from '@/lib/graphql/operations/entries'
import { executeQuery } from '@/lib/graphql-client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { nextEntryLookupRetryDelay } from '../_lib/entry-lookup-retry'

interface UseEntryOverallOptions {
	entryId: number
	currentGameweek: number
	selectedGameweek?: number
	initialEntryId: number
	initialEventId: number
	initialOverall?: EntryOverallSnapshot
	initialEntryLookupStatus?: EntryLookupStatus
	initialEntryPersistenceState?: EntryPersistenceState | null
}

interface EntryOverallState {
	overall?: EntryOverallSnapshot
	entryLookupStatus?: EntryLookupStatus
	entryPersistenceState?: EntryPersistenceState | null
	retryEntryLookup: () => void
}

export function useEntryOverall({
	entryId,
	currentGameweek,
	selectedGameweek,
	initialEntryId,
	initialEventId,
	initialOverall,
	initialEntryLookupStatus,
	initialEntryPersistenceState
}: UseEntryOverallOptions): EntryOverallState {
	const [overall, setOverall] = useState(initialOverall)
	const [entryLookupStatus, setEntryLookupStatus] = useState<
		EntryLookupStatus | undefined
	>(initialEntryLookupStatus)
	const [entryPersistenceState, setEntryPersistenceState] = useState<
		EntryPersistenceState | null | undefined
	>(initialEntryPersistenceState)
	const [reloadRevision, setReloadRevision] = useState(0)
	const loadedKeyRef = useRef<string | null>(
		initialOverall != null ? `${initialEntryId}:${initialEventId}` : null
	)
	const lookupKeyRef = useRef<string | null>(
		`${initialEntryId}:${initialEventId}`
	)
	const retryKeyRef = useRef<string | null>(null)
	const automaticRetryCountRef = useRef(0)

	useEffect(() => {
		setOverall(initialOverall)
		setEntryLookupStatus(initialEntryLookupStatus)
		setEntryPersistenceState(initialEntryPersistenceState)
		loadedKeyRef.current =
			initialOverall != null ? `${initialEntryId}:${initialEventId}` : null
		lookupKeyRef.current = `${initialEntryId}:${initialEventId}`
		retryKeyRef.current = null
		automaticRetryCountRef.current = 0
	}, [
		initialEntryId,
		initialEventId,
		initialEntryLookupStatus,
		initialEntryPersistenceState,
		initialOverall
	])

	const retryEntryLookup = useCallback(() => {
		loadedKeyRef.current = null
		retryKeyRef.current = null
		automaticRetryCountRef.current = 0
		setReloadRevision(revision => revision + 1)
	}, [])

	useEffect(() => {
		const effectiveGameweek = selectedGameweek ?? currentGameweek
		if (entryId <= 0 || effectiveGameweek !== currentGameweek) {
			setOverall(undefined)
			setEntryLookupStatus(undefined)
			setEntryPersistenceState(undefined)
			loadedKeyRef.current = null
			lookupKeyRef.current = null
			retryKeyRef.current = null
			automaticRetryCountRef.current = 0
			return
		}

		const lookupKey = `${entryId}:${currentGameweek}`
		if (lookupKeyRef.current !== lookupKey) {
			// A new entry must not inherit the previous entry's status while its
			// lookup is pending. Keep retry state separate so a same-entry retry
			// does not look like a new selection.
			setOverall(undefined)
			setEntryLookupStatus(undefined)
			setEntryPersistenceState(undefined)
			lookupKeyRef.current = lookupKey
		}
		if (loadedKeyRef.current === lookupKey) return
		if (retryKeyRef.current !== lookupKey) {
			retryKeyRef.current = lookupKey
			automaticRetryCountRef.current = 0
		}
		loadedKeyRef.current = lookupKey

		let cancelled = false
		let retryTimer: ReturnType<typeof setTimeout> | undefined
		const scheduleRetry = (retryable = true) => {
			loadedKeyRef.current = null
			const retryDelay = nextEntryLookupRetryDelay(
				retryable,
				automaticRetryCountRef.current
			)
			if (retryDelay == null) return
			automaticRetryCountRef.current += 1
			retryTimer = setTimeout(() => {
				if (!cancelled) setReloadRevision(revision => revision + 1)
			}, retryDelay)
		}

		void executeQuery<EntrySummaryResponse>(
			GET_ENTRY,
			{ id: entryId },
			{ cache: 'no-store' }
		)
			.then(response => {
				if (cancelled) return
				const lookup = response.entryLookup
				if (!lookup) {
					throw new Error('Entry lookup response is missing entryLookup')
				}
				setEntryLookupStatus(lookup.status)
				setEntryPersistenceState(lookup.persistenceState)
				if (lookup.status !== 'FOUND' || !lookup.entry) {
					setOverall(undefined)
					if (lookup.retryable) scheduleRetry(lookup.retryable)
					else automaticRetryCountRef.current = 0
					return
				}

				setOverall({
					overallPoints: lookup.entry.overallPoints,
					overallRank: lookup.entry.overallRank,
					teamValue: lookup.entry.teamValue,
					bank: lookup.entry.bank,
					totalTransfers: lookup.entry.totalTransfers
				})
				automaticRetryCountRef.current = 0
			})
			.catch(error => {
				if (cancelled) return
				setOverall(undefined)
				setEntryLookupStatus('UNAVAILABLE')
				setEntryPersistenceState(undefined)
				scheduleRetry()
				console.warn('[live points] overall snapshot fetch failed:', error)
			})

		return () => {
			cancelled = true
			if (retryTimer) clearTimeout(retryTimer)
		}
	}, [entryId, currentGameweek, selectedGameweek, reloadRevision])

	return {
		overall,
		entryLookupStatus,
		entryPersistenceState,
		retryEntryLookup
	}
}
