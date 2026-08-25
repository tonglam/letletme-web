import { signInMiniProgramWithWeChat } from '@/lib/miniprogram-account'
import {
	recordAuthEvent,
	updateAuthObservationContext
} from '@/lib/auth-observability'
import {
	enforceMiniProgramRateLimits,
	miniProgramErrorResponse,
	miniProgramSuccessResponse,
	readMiniProgramJson,
	setMiniProgramAuthObservation,
	withMiniProgramAuthRequest
} from '@/lib/miniprogram-route-security'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	return withMiniProgramAuthRequest(request, 'wechat-login', async () => {
		try {
			const body = await readMiniProgramJson(request)
			setMiniProgramAuthObservation(body)
			await enforceMiniProgramRateLimits({ request, scope: 'wechat-login', body })
			const result = await signInMiniProgramWithWeChat({
				code: body.code,
				deviceId: body.deviceId,
				contractVersion: body.contractVersion
			})
			const { observability, ...publicResult } = result
			if (observability) {
				updateAuthObservationContext({
					miniAccountId: observability.accountId,
					miniDeviceId: observability.deviceId,
					webUserId: observability.webUserId,
					sessionId: observability.sessionId
				})
				recordAuthEvent({
					eventType: 'session_issued',
					channel: 'mini',
					operation: 'wechat-login',
					outcome: 'succeeded',
					miniAccountId: observability.accountId,
					webUserId: observability.webUserId,
					sessionId: observability.sessionId,
					deviceId: observability.deviceId,
					revokedSessionCount: observability.revokedSessionCount
				})
			}

			return miniProgramSuccessResponse({ success: true, ...publicResult })
		} catch (error) {
			return miniProgramErrorResponse(error, 'Failed to sign in')
		}
	})
}
