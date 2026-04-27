'use server'

import { getAuth } from '@/lib/auth'
import { db, schema } from '@/lib/db'
import { validateFplEntry } from '@/lib/fpl'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation' // used for unauthenticated guard

type BindResult = { error?: string; success?: string }

export async function bindFplEntry(
	prevState: BindResult | null,
	formData: FormData,
): Promise<BindResult> {
	const reqHeaders = await headers()
	const session = await getAuth().api.getSession({ headers: reqHeaders })

	if (!session) {
		redirect('/auth/login')
	}

	const raw = formData.get('entryId')
	const entryId = Number(raw)

	if (!Number.isInteger(entryId) || entryId <= 0) {
		return { error: 'Enter a valid FPL entry ID (positive integer)' }
	}

	const { valid, teamName, managerName } = await validateFplEntry(entryId)

	if (!valid) {
		return {
			error: `No FPL team found with ID ${entryId}. Check your FPL entry number.`,
		}
	}

	// input: false on additionalFields blocks auth.api.updateUser — write directly.
	await db
		.update(schema.user)
		.set({ fplEntryId: entryId, fplEntryBoundAt: new Date() })
		.where(eq(schema.user.id, session.user.id))

	return { success: `${teamName} (${managerName}) linked successfully` }
}
