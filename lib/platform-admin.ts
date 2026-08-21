export type PlatformAdminIdentity = {
	id?: string | null
	fplEntryId?: number | null
	fplEntryVerifiedAt?: Date | string | null
}

const ENTRY_CONFIG_NAME = 'PLATFORM_ADMIN_FPL_ENTRY_IDS'
const USER_CONFIG_NAME = 'PLATFORM_ADMIN_USER_IDS'

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
				`${ENTRY_CONFIG_NAME} must contain comma-separated positive integers`
			)
		}
		const entryId = Number(token)
		if (!Number.isSafeInteger(entryId)) {
			throw new Error(`${ENTRY_CONFIG_NAME} contains an unsafe integer`)
		}
		entryIds.add(entryId)
	}
	return entryIds
}

export function parsePlatformAdminUserIds(
	rawValue: string | undefined
): ReadonlySet<string> {
	const value = rawValue?.trim() ?? ''
	if (!value) return new Set()

	const userIds = new Set<string>()
	for (const rawToken of value.split(',')) {
		const userId = rawToken.trim()
		if (
			!userId ||
			userId.length > 128 ||
			/[\u0000-\u001f\u007f]/.test(userId)
		) {
			throw new Error(
				`${USER_CONFIG_NAME} must contain comma-separated non-empty user IDs`
			)
		}
		userIds.add(userId)
	}
	return userIds
}

export function isPlatformAdminIdentity(
	identity: PlatformAdminIdentity,
	rawEntryValue = process.env.PLATFORM_ADMIN_FPL_ENTRY_IDS,
	rawUserValue = process.env.PLATFORM_ADMIN_USER_IDS
): boolean {
	if (
		typeof identity.id !== 'string' ||
		identity.id.length === 0 ||
		typeof identity.fplEntryId !== 'number' ||
		!Number.isSafeInteger(identity.fplEntryId) ||
		identity.fplEntryId <= 0 ||
		!identity.fplEntryVerifiedAt
	) {
		return false
	}

	const verifiedAt = new Date(identity.fplEntryVerifiedAt)
	if (!Number.isFinite(verifiedAt.getTime())) return false

	return (
		parsePlatformAdminUserIds(rawUserValue).has(identity.id) &&
		parsePlatformAdminFplEntryIds(rawEntryValue).has(identity.fplEntryId)
	)
}
