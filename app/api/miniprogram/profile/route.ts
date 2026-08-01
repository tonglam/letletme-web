import { getMiniProgramProfileByToken } from '@/lib/miniprogram-account'
import { getBearerToken, MiniProgramAuthError } from '@/lib/miniprogram-account-core'
import {
	miniProgramErrorResponse,
	miniProgramSuccessResponse,
} from '@/lib/miniprogram-route-security'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
	try {
		const token = getBearerToken(request.headers.get('authorization'))
		if (!token) {
			throw new MiniProgramAuthError('Unauthenticated', 401)
		}

		const profile = await getMiniProgramProfileByToken(token)
		return miniProgramSuccessResponse({ success: true, profile })
	} catch (error) {
		return miniProgramErrorResponse(error, 'Failed to load profile')
	}
}
