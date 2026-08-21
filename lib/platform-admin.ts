export type PlatformAdminIdentity = {
	fplEntryId?: number | null
	fplEntryVerifiedAt?: Date | string | null
}

const CONFIG_NAME = 'PLATFORM_ADMIN_FPL_ENTRY_IDS'

export function parsePlatformAdminFplEntryIds(
	rawValue: string | undefined
): ReadonlySet<number> {
	const value = rawValue?.trim() ?? ''
	if (!value) return new Set()

	const entryIds = new Set<number>()
	for (const rawToken of value.split(',')) {
		const token = rawToken.trim()
		if (!/^[1-9]\d*$/.test(token)) {
			throw new Error(
				`${CONFIG_NAME} must contain comma-separated positive integers`
			)
		}
		const entryId = Number(token)
		if (!Number.isSafeInteger(entryId)) {
			throw new Error(`${CONFIG_NAME} contains an unsafe integer`)
		}
		entryIds.add(entryId)
	}
	return entryIds
}

export function isPlatformAdminIdentity(
	identity: PlatformAdminIdentity,
	rawValue = process.env.PLATFORM_ADMIN_FPL_ENTRY_IDS
): boolean {
	if (
		typeof identity.fplEntryId !== 'number' ||
		!Number.isSafeInteger(identity.fplEntryId) ||
		identity.fplEntryId <= 0 ||
		!identity.fplEntryVerifiedAt
	) {
		return false
	}

	const verifiedAt = new Date(identity.fplEntryVerifiedAt)
	if (!Number.isFinite(verifiedAt.getTime())) return false

	return parsePlatformAdminFplEntryIds(rawValue).has(identity.fplEntryId)
}
