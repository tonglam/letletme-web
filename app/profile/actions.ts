'use server'

import { getAuth } from '@/lib/auth'
import { db, schema } from '@/lib/db'
import { validateFplEntry } from '@/lib/fpl'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

type UpdateResult = { error?: string; success?: string; newEntryId?: number }

export async function updateFplEntry(
	prevState: UpdateResult | null,
	formData: FormData,
): Promise<UpdateResult> {
	const reqHeaders = await headers()
	const session = await getAuth().api.getSession({ headers: reqHeaders })

	if (!session) return { error: 'Not authenticated' }

	const raw = formData.get('entryId')
	const entryId = Number(raw)

	if (!Number.isInteger(entryId) || entryId <= 0) {
		return { error: 'Enter a valid FPL entry ID (positive integer)' }
	}

	const { valid, teamName, managerName } = await validateFplEntry(entryId)

	if (!valid) {
		return {
			error: `No FPL team found with ID ${entryId}. Check the number and try again.`,
		}
	}

	// input: false on additionalFields blocks auth.api.updateUser — write directly.
	await db
		.update(schema.user)
		.set({ fplEntryId: entryId, fplEntryBoundAt: new Date() })
		.where(eq(schema.user.id, session.user.id))

	revalidatePath('/profile')
	return {
		success: `Linked to ${teamName} (${managerName})`,
		newEntryId: entryId,
	}
}
