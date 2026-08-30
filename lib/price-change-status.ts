const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Return the number of calendar days remaining before an official price lock
 * ends. The official UI rounds a partial day up so a player never appears to
 * unlock earlier than the upstream timestamp.
 */
export function getPriceChangeUnlockDays(
	lockedUntil: string | null,
	now = Date.now()
): number | null {
	if (!lockedUntil || !Number.isFinite(now)) return null

	const unlockAt = Date.parse(lockedUntil)
	if (!Number.isFinite(unlockAt) || unlockAt <= now) return null

	return Math.max(1, Math.ceil((unlockAt - now) / MILLISECONDS_PER_DAY))
}
