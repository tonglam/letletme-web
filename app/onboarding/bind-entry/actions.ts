'use server'

import { getAuthorizationSession } from '@/lib/auth'
import {
	FplBindingError,
	confirmFplEntryBindingChallenge,
	startFplEntryBindingChallenge,
} from '@/lib/fpl-entry-binding'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation' // used for unauthenticated guard

export type BindResult = {
	error?: string
	success?: string
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

	if (!session) {
		redirect('/auth/login')
	}

	try {
		const challengeId = formData.get('challengeId')
		if (challengeId) {
			const verified = await confirmFplEntryBindingChallenge(
				session.user.id,
				challengeId,
			)
			return {
				success: `${verified.teamName} (${verified.managerName}) verified successfully`,
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
			error: error instanceof FplBindingError || error instanceof Error
				? error.message
				: 'Unable to verify the FPL entry',
		}
	}
}
