/** Resolve the effective selected gameweek within [1, maxGameweek]. */
export function resolveSelectedGameweek(
	currentGameweek: number | null,
	selectedGameweek?: number
): { maxGameweek: number; selected: number } {
	const maxGameweek = Math.max(1, currentGameweek ?? 1)
	const selected =
		selectedGameweek !== undefined
			? Math.min(maxGameweek, Math.max(1, selectedGameweek))
			: maxGameweek
	return { maxGameweek, selected }
}

/** Newest → oldest values for the select list (current sits at top). */
export function buildGameweekValuesDesc(maxGameweek: number): number[] {
	const max = Math.max(1, maxGameweek)
	const values: number[] = []
	for (let i = max; i >= 1; i--) values.push(i)
	return values
}

/**
 * Parse a jump-to input. Returns clamped integer in [1, maxGameweek],
 * or null when the draft is not a valid integer (caller should reset).
 */
export function parseGameweekJump(
	draft: string,
	maxGameweek: number
): number | null {
	const parsed = Number.parseInt(draft, 10)
	if (!Number.isInteger(parsed)) return null
	const max = Math.max(1, maxGameweek)
	return Math.min(max, Math.max(1, parsed))
}

export function canStepGameweek(
	selected: number,
	maxGameweek: number,
	disabled: boolean
): { prev: boolean; next: boolean } {
	if (disabled) return { prev: false, next: false }
	const max = Math.max(1, maxGameweek)
	return {
		prev: selected > 1,
		next: selected < max
	}
}
