import { confirmMiniProgramEmailBinding } from '@/lib/miniprogram-account'
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
	withMiniProgramAuthRequest,
} from '@/lib/miniprogram-route-security'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	return withMiniProgramAuthRequest(request, 'email-link-confirm', async () => {
		try {
			const body = await readMiniProgramJson(request)
			setMiniProgramAuthObservation(body)
			await enforceMiniProgramRateLimits({ request, scope: 'email-confirm', body })
			const result = await confirmMiniProgramEmailBinding({
				email: body.email,
				deviceId: body.deviceId,
				code: body.code,
				wechatCode: body.wechatCode
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
					eventType: 'account_link',
					channel: 'mini',
					operation: 'email-link-confirm',
					outcome: 'succeeded',
					miniAccountId: observability.accountId,
					webUserId: observability.webUserId,
					sessionId: observability.sessionId,
					deviceId: observability.deviceId,
					email: typeof body.email === 'string' ? body.email : undefined,
					revokedSessionCount: observability.revokedSessionCount
				})
				recordAuthEvent({
					eventType: 'session_issued',
					channel: 'mini',
					operation: 'email-link-confirm',
					outcome: 'succeeded',
					miniAccountId: observability.accountId,
						webUserId: observability.webUserId,
						sessionId: observability.sessionId,
						deviceId: observability.deviceId
					})
			}

			return miniProgramSuccessResponse({ success: true, ...publicResult })
		} catch (error) {
			return miniProgramErrorResponse(error, 'Failed to confirm code')
		}
	})
}
