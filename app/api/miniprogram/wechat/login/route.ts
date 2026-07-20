import { signInMiniProgramWithWeChat } from '@/lib/miniprogram-account'
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
		await enforceMiniProgramRateLimits({ request, scope: 'wechat-login', body })
		const result = await signInMiniProgramWithWeChat({
			code: body?.code,
			deviceId: body?.deviceId,
		})

		return miniProgramSuccessResponse({ success: true, ...result })
	} catch (error) {
		return miniProgramErrorResponse(error, 'Failed to sign in')
	}
}
