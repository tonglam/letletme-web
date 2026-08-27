export const ENTRY_LOOKUP_MAX_AUTOMATIC_RETRIES = 2
const ENTRY_LOOKUP_RETRY_DELAY_MS = 1_500

export function nextEntryLookupRetryDelay(
	retryable: boolean,
	completedAutomaticRetries: number
): number | null {
	if (
		!retryable ||
		!Number.isInteger(completedAutomaticRetries) ||
		completedAutomaticRetries < 0 ||
		completedAutomaticRetries >= ENTRY_LOOKUP_MAX_AUTOMATIC_RETRIES
	) {
		return null
	}
	return ENTRY_LOOKUP_RETRY_DELAY_MS * (completedAutomaticRetries + 1)
}
