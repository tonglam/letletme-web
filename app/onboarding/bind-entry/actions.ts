'use server'

import { getAuthorizationSession } from '@/lib/auth'
import { getFplBindingErrorCode, type FplBindingErrorCode } from '@/lib/fpl-binding-error-code'
import {
	confirmFplEntryBindingChallenge,
	startFplEntryBindingChallenge,
} from '@/lib/fpl-entry-binding'
import { headers } from 'next/headers'

export type BindResult = {
	errorCode?: FplBindingErrorCode
	success?: boolean
	teamName?: string
	managerName?: string
	challengeId?: string
	entryId?: number
	requiredName?: string
	expiresAt?: string
}

export async function bindFplEntry(
	prevState: BindResult | null,
	formData: FormData,
): Promise<BindResult> {
	const reqHeaders = await headers()
	const session = await getAuthorizationSession(reqHeaders)

	if (!session) return { errorCode: 'notAuthenticated' }

	try {
		const challengeId = formData.get('challengeId')
		if (challengeId) {
			const verified = await confirmFplEntryBindingChallenge(session.user.id, challengeId)
			return {
				success: true,
				teamName: verified.teamName,
				managerName: verified.managerName,
				entryId: verified.entryId,
			}
		}

		const challenge = await startFplEntryBindingChallenge(
			session.user.id,
			formData.get('entryId'),
		)
		return {
			challengeId: challenge.id,
			entryId: challenge.entryId,
			requiredName: challenge.requiredName,
			expiresAt: challenge.expiresAt,
		}
	} catch (error) {
		return {
			...prevState,
			success: undefined,
			errorCode: getFplBindingErrorCode(error),
		}
	}
}
