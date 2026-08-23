import {
	clearMiniProgramFollowEntry,
	setMiniProgramFollowEntry,
} from '@/lib/miniprogram-account'
import { getBearerToken, MiniProgramAuthError } from '@/lib/miniprogram-account-core'
import {
	enforceMiniProgramMutationRateLimits,
	miniProgramErrorResponse,
	miniProgramSuccessResponse,
	readMiniProgramJson,
} from '@/lib/miniprogram-route-security'

export const dynamic = 'force-dynamic'

function requireToken(request: Request): string {
	const token = getBearerToken(request.headers.get('authorization'))
	if (!token) throw new MiniProgramAuthError('Unauthenticated', 401)
	return token
}

export async function PUT(request: Request) {
	try {
		const token = requireToken(request)
		await enforceMiniProgramMutationRateLimits({
			request,
			token,
			scope: 'follow-entry',
		})
		const body = await readMiniProgramJson(request)
		const profile = await setMiniProgramFollowEntry(token, body.entryId)
		return miniProgramSuccessResponse({ success: true, profile })
	} catch (error) {
		return miniProgramErrorResponse(error, '这次没法保存球队，请稍后再试')
	}
}

export async function DELETE(request: Request) {
	try {
		const token = requireToken(request)
		await enforceMiniProgramMutationRateLimits({
			request,
			token,
			scope: 'follow-entry',
		})
		const profile = await clearMiniProgramFollowEntry(token)
		return miniProgramSuccessResponse({ success: true, profile })
	} catch (error) {
		return miniProgramErrorResponse(error, '这次没法取消球队，请稍后再试')
	}
}
