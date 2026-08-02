'use server'

import { getAuthorizationSession } from '@/lib/auth'
import {
	getFplBindingErrorCode,
	type FplBindingErrorCode,
} from '@/lib/fpl-binding-error-code'
import { bindFplEntryDirectly } from '@/lib/fpl-entry-binding'
import { headers } from 'next/headers'

export type BindResult = {
	errorCode?: FplBindingErrorCode
	success?: boolean
	teamName?: string
	managerName?: string
	entryId?: number
}

export async function bindFplEntry(
	_prevState: BindResult | null,
	formData: FormData,
): Promise<BindResult> {
	const reqHeaders = await headers()
	const session = await getAuthorizationSession(reqHeaders)

	if (!session) return { errorCode: 'notAuthenticated' }

	try {
		const bound = await bindFplEntryDirectly(session.user.id, formData.get('entryId'))
		return {
			success: true,
			teamName: bound.teamName,
			managerName: bound.managerName,
			entryId: bound.entryId,
		}
	} catch (error) {
		return { errorCode: getFplBindingErrorCode(error) }
	}
}
