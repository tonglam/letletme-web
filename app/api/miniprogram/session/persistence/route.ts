import { recordAuthEvent, updateAuthObservationContext } from '@/lib/auth-observability'
import { normalizeRequestId } from '@/lib/auth-observability-core'
import {
	getMiniProgramSessionIdentity
} from '@/lib/miniprogram-account'
import { getBearerToken, MiniProgramAuthError } from '@/lib/miniprogram-account-core'
import {
	miniProgramErrorResponse,
	miniProgramSuccessResponse,
	enforceMiniProgramMutationRateLimits,
	readMiniProgramJson,
	withMiniProgramAuthRequest
} from '@/lib/miniprogram-route-security'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	return withMiniProgramAuthRequest(request, 'session-persistence', async () => {
		try {
			const token = getBearerToken(request.headers.get('authorization'))
			if (!token) throw new MiniProgramAuthError('Unauthenticated', 401)
			await enforceMiniProgramMutationRateLimits({
				request,
				token,
				scope: 'session-persistence'
			})
			const body = await readMiniProgramJson(request)
			const requestId = normalizeRequestId(body.requestId)
			if (!requestId) throw new MiniProgramAuthError('Invalid request ID', 400)
			if (body.outcome !== 'encrypted' && body.outcome !== 'memory_only') {
				throw new MiniProgramAuthError('Invalid persistence outcome', 400)
			}
			if (
				body.outcome === 'memory_only' &&
				body.reason !== 'unsupported' &&
				body.reason !== 'write_failed'
			) {
				throw new MiniProgramAuthError('Invalid persistence reason', 400)
			}

			const identity = await getMiniProgramSessionIdentity(token)
			updateAuthObservationContext({
				miniAccountId: identity.accountId,
				miniDeviceId: identity.deviceId,
				webUserId: identity.webUserId,
				sessionId: identity.sessionId
			})
			recordAuthEvent({
				eventType: 'session_persistence',
				channel: 'mini',
				operation: 'session-persistence',
				outcome: body.outcome === 'encrypted' ? 'succeeded' : 'failed',
				errorCode:
					body.outcome === 'encrypted'
						? undefined
						: body.reason === 'unsupported'
							? 'storage_unsupported'
							: 'storage_write_failed',
				credentialState:
					body.outcome === 'encrypted' ? 'encrypted' : 'memory_only',
				requestId,
				miniAccountId: identity.accountId,
				webUserId: identity.webUserId,
				sessionId: identity.sessionId,
				deviceId: identity.deviceId,
				loginContext: undefined
			})
			return miniProgramSuccessResponse({ success: true })
		} catch (error) {
			return miniProgramErrorResponse(error, 'Failed to record session persistence')
		}
	})
}
