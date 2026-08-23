import { unlinkMiniProgramWebAccount } from '@/lib/miniprogram-account'
import { getBearerToken, MiniProgramAuthError } from '@/lib/miniprogram-account-core'
import {
	enforceMiniProgramMutationRateLimits,
	miniProgramErrorResponse,
	miniProgramSuccessResponse,
} from '@/lib/miniprogram-route-security'

export const dynamic = 'force-dynamic'

export async function DELETE(request: Request) {
	try {
		const token = getBearerToken(request.headers.get('authorization'))
		if (!token) throw new MiniProgramAuthError('Unauthenticated', 401)
		await enforceMiniProgramMutationRateLimits({
			request,
			token,
			scope: 'account-unlink',
		})
		const profile = await unlinkMiniProgramWebAccount(token)
		return miniProgramSuccessResponse({ success: true, profile })
	} catch (error) {
		return miniProgramErrorResponse(error, '这次没法解除网页关联，请稍后再试')
	}
}
