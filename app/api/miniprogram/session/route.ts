import { recordAuthEvent, updateAuthObservationContext } from '@/lib/auth-observability'
import { revokeMiniProgramSession } from '@/lib/miniprogram-account'
import { getBearerToken, MiniProgramAuthError } from '@/lib/miniprogram-account-core'
import {
	enforceLogoutRateLimit,
	miniProgramErrorResponse,
	miniProgramSuccessResponse,
	withMiniProgramAuthRequest,
} from '@/lib/miniprogram-route-security'

export const dynamic = 'force-dynamic'

export async function DELETE(request: Request) {
	return withMiniProgramAuthRequest(request, 'logout', async () => {
		try {
			await enforceLogoutRateLimit({ request, channel: 'mini' })
			const token = getBearerToken(request.headers.get('authorization'))
			if (!token) {
				throw new MiniProgramAuthError('Unauthenticated', 401)
			}

			const audit = await revokeMiniProgramSession(token)
			if (audit) {
				updateAuthObservationContext({
					miniAccountId: audit.accountId,
					miniDeviceId: audit.deviceId,
					webUserId: audit.webUserId,
					sessionId: audit.sessionId
				})
				recordAuthEvent({
					eventType: 'session_revoked',
					channel: 'mini',
					operation: 'logout',
					outcome: 'succeeded',
					miniAccountId: audit.accountId,
					webUserId: audit.webUserId,
					sessionId: audit.sessionId,
					deviceId: audit.deviceId,
					revokedSessionCount: audit.revokedSessionCount
				})
			}
			return miniProgramSuccessResponse({ success: true })
		} catch (error) {
			return miniProgramErrorResponse(error, 'Failed to sign out')
		}
	})
}
