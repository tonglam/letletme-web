/**
 * Return the FPL defensive-contribution award for one player in an event.
 *
 * The raw contribution count is exposed separately from the points award;
 * this helper is only for reconstructing the scoring line when the explain
 * payload is not available yet.
 */
export function getDefensiveContributionPoints(
	elementType: number | undefined,
	contribution: number | null | undefined
): number {
	const value = contribution ?? 0
	if (elementType === 2) return value >= 10 ? 2 : 0
	if (elementType === 3 || elementType === 4) return value >= 12 ? 2 : 0
	return 0
}
