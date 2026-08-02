'use server'

import { getAuthorizationSession } from '@/lib/auth'
import {
	getFplBindingErrorCode,
	shouldRetainFplBindingChallenge,
	type FplBindingErrorCode,
} from '@/lib/fpl-binding-error-code'
import {
	confirmFplEntryBindingChallenge,
	startFplEntryBindingChallenge,
} from '@/lib/fpl-entry-binding'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

export type UpdateResult = {
	errorCode?: FplBindingErrorCode
	success?: boolean
	teamName?: string
	managerName?: string
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

	if (!session) return { errorCode: 'notAuthenticated' }

	try {
		const challengeId = formData.get('challengeId')
		if (challengeId) {
			const verified = await confirmFplEntryBindingChallenge(session.user.id, challengeId)
			revalidatePath('/profile')
			return {
				success: true,
				teamName: verified.teamName,
				managerName: verified.managerName,
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
		const errorCode = getFplBindingErrorCode(error)
		if (!prevState?.challengeId || !shouldRetainFplBindingChallenge(errorCode)) {
			return { errorCode }
		}

		return {
			...prevState,
			success: undefined,
			errorCode,
		}
	}
}
