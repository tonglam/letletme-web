import { chooseMiniProgramEntrySource } from '@/lib/miniprogram-account'
import { getBearerToken, MiniProgramAuthError } from '@/lib/miniprogram-account-core'
import {
	enforceMiniProgramMutationRateLimits,
	miniProgramErrorResponse,
	miniProgramSuccessResponse,
	readMiniProgramJson,
} from '@/lib/miniprogram-route-security'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request) {
	try {
		const token = getBearerToken(request.headers.get('authorization'))
		if (!token) throw new MiniProgramAuthError('Unauthenticated', 401)
		await enforceMiniProgramMutationRateLimits({
			request,
			token,
			scope: 'entry-choice',
		})
		const body = await readMiniProgramJson(request)
		const profile = await chooseMiniProgramEntrySource({
			token,
			choice: body.choice,
			miniEntryId: body.miniEntryId,
			webEntryId: body.webEntryId,
		})
		return miniProgramSuccessResponse({ success: true, profile })
	} catch (error) {
		return miniProgramErrorResponse(error, '这次没法保存球队选择，请稍后再试')
	}
}
