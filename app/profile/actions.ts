'use server'

import { getAuthorizationSession } from '@/lib/auth'
import {
	getFplBindingErrorCode,
	type FplBindingErrorCode,
} from '@/lib/fpl-binding-error-code'
import { bindFplEntryDirectly, unlinkFplEntry as unlinkUserFplEntry } from '@/lib/fpl-entry-binding'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

export type UpdateResult = {
	errorCode?: FplBindingErrorCode
	success?: boolean
	teamName?: string
	managerName?: string
	newEntryId?: number
}

export async function updateFplEntry(
	_prevState: UpdateResult | null,
	formData: FormData,
): Promise<UpdateResult> {
	const reqHeaders = await headers()
	const session = await getAuthorizationSession(reqHeaders)

	if (!session) return { errorCode: 'notAuthenticated' }

	try {
		const bound = await bindFplEntryDirectly(session.user.id, formData.get('entryId'))
		revalidatePath('/profile')
		return {
			success: true,
			teamName: bound.teamName,
			managerName: bound.managerName,
			newEntryId: bound.entryId,
		}
	} catch (error) {
		return { errorCode: getFplBindingErrorCode(error) }
	}
}

export async function unlinkFplEntry(): Promise<{
	errorCode?: FplBindingErrorCode
	success?: boolean
}> {
	const reqHeaders = await headers()
	const session = await getAuthorizationSession(reqHeaders)

	if (!session) return { errorCode: 'notAuthenticated' }

	try {
		await unlinkUserFplEntry(session.user.id)
		revalidatePath('/profile')
		return { success: true }
	} catch (error) {
		return { errorCode: getFplBindingErrorCode(error) }
	}
}
