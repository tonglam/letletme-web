import 'server-only'

import { lte } from 'drizzle-orm'

import { db } from '@/lib/db'
import { bugReportStorageNonce } from '@/lib/db/schema/auth'

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

/** Reserve a verified nonce in the shared database for cross-instance replay protection. */
export async function consumeBugReportStorageNonce(
	nonce: string,
	now = new Date()
): Promise<boolean> {
	if (!nonce || nonce.length > 128) return false
	await db
		.delete(bugReportStorageNonce)
		.where(lte(bugReportStorageNonce.expiresAt, now))
	const [inserted] = await db
		.insert(bugReportStorageNonce)
		.values({
			nonce,
			expiresAt: new Date(now.getTime() + MAX_CLOCK_SKEW_MS)
		})
		.onConflictDoNothing({ target: bugReportStorageNonce.nonce })
		.returning({ nonce: bugReportStorageNonce.nonce })
	return Boolean(inserted)
}
