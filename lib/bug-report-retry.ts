export type BugReportDataAttemptOutcome = 'success' | 'definitive-rejection' | 'ambiguous'

/**
 * An attachment is safe to remove only when the final Data outcome is a
 * definitive rejection and no earlier attempt was ambiguous. An ambiguous
 * response may mean that Data committed the report before the response was
 * lost, so the private retention/orphan sweep must own cleanup instead.
 */
export function canCleanupBugReportScreenshotAfterDataAttempts(
	attempts: readonly BugReportDataAttemptOutcome[]
): boolean {
	return (
		attempts.length > 0 &&
		attempts.at(-1) === 'definitive-rejection' &&
		attempts.every(outcome => outcome === 'definitive-rejection')
	)
}
