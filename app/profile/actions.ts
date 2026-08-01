'use server'

import { getAuthorizationSession } from '@/lib/auth'
import {
	FplBindingError,
	confirmFplEntryBindingChallenge,
	startFplEntryBindingChallenge,
} from '@/lib/fpl-entry-binding'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

export type UpdateResult = {
	error?: string
	success?: string
	newEntryId?: number
	challengeId?: string
	requiredName?: string
	expiresAt?: string
}

export async function updateFplEntry(
	prevState: UpdateResult | null,
	formData: FormData,
): Promise<UpdateResult> {
	const reqHeaders = await headers()
	const session = await getAuthorizationSession(reqHeaders)

	if (!session) return { error: 'Not authenticated' }

	try {
		const challengeId = formData.get('challengeId')
		if (challengeId) {
			const verified = await confirmFplEntryBindingChallenge(
				session.user.id,
				challengeId,
			)
			revalidatePath('/profile')
			return {
				success: `Verified ${verified.teamName} (${verified.managerName})`,
				newEntryId: verified.entryId,
			}
		}

		const challenge = await startFplEntryBindingChallenge(
			session.user.id,
			formData.get('entryId'),
		)
		return {
			newEntryId: challenge.entryId,
			challengeId: challenge.id,
			requiredName: challenge.requiredName,
			expiresAt: challenge.expiresAt,
		}
	} catch (error) {
		return {
			error: error instanceof FplBindingError || error instanceof Error
				? error.message
				: 'Unable to verify the FPL entry',
		}
	}
}
