import type {
	EntryLookupStatus,
	EntryPersistenceState
} from '@/lib/graphql/operations/entries'

export type EntryLookupMessageKey =
	| 'invalidEntry'
	| 'entryNotFound'
	| 'entryBusy'
	| 'entryUnavailable'
	| 'entryPersistenceQueued'
	| 'entryPersistenceFailed'

export type EntryLookupPresentation = Readonly<{
	messageKey: EntryLookupMessageKey
	retryable: boolean
}>

export type EntryPersistencePresentation = Readonly<{
	messageKey: EntryLookupMessageKey
	retryable: boolean
}>

export function entryLookupPresentation(
	status: EntryLookupStatus | undefined
): EntryLookupPresentation | null {
	switch (status) {
		case undefined:
		case 'FOUND':
			return null
		case 'INVALID_ID':
			return { messageKey: 'invalidEntry', retryable: false }
		case 'NOT_FOUND':
			return { messageKey: 'entryNotFound', retryable: false }
		case 'SATURATED':
			return { messageKey: 'entryBusy', retryable: true }
		case 'UNAVAILABLE':
			return { messageKey: 'entryUnavailable', retryable: true }
	}
}

export function entryPersistencePresentation(
	state: EntryPersistenceState | null | undefined
): EntryPersistencePresentation | null {
	switch (state) {
		case undefined:
		case null:
		case 'NOT_REQUIRED':
			return null
		case 'QUEUED':
			return { messageKey: 'entryPersistenceQueued', retryable: false }
		case 'FAILED_RETRYABLE':
			return { messageKey: 'entryPersistenceFailed', retryable: true }
	}
}
