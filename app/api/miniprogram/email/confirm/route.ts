import { confirmMiniProgramEmailBinding } from '@/lib/miniprogram-account'
import {
	enforceMiniProgramRateLimits,
	miniProgramErrorResponse,
	miniProgramSuccessResponse,
	readMiniProgramJson,
} from '@/lib/miniprogram-route-security'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	try {
		const body = await readMiniProgramJson(request)
		await enforceMiniProgramRateLimits({ request, scope: 'email-confirm', body })
		const result = await confirmMiniProgramEmailBinding({
			email: body?.email,
			deviceId: body?.deviceId,
			code: body?.code,
			wechatCode: body?.wechatCode,
		})

		return miniProgramSuccessResponse({ success: true, ...result })
	} catch (error) {
		return miniProgramErrorResponse(error, 'Failed to confirm code')
	}
}
