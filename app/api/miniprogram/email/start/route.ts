import { startMiniProgramEmailBinding } from '@/lib/miniprogram-account'
import { recordAuthEvent } from '@/lib/auth-observability'
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
	return withMiniProgramAuthRequest(request, 'email-link-start', async () => {
		try {
			const body = await readMiniProgramJson(request)
			setMiniProgramAuthObservation(body)
			await enforceMiniProgramRateLimits({ request, scope: 'email-start', body })
			await startMiniProgramEmailBinding({
				email: body.email,
				deviceId: body.deviceId
			})
			recordAuthEvent({
				eventType: 'account_link',
				channel: 'mini',
				operation: 'email-link-start',
				outcome: 'succeeded',
				email: typeof body.email === 'string' ? body.email : undefined,
				deviceId: typeof body.deviceId === 'string' ? body.deviceId : undefined
			})

			return miniProgramSuccessResponse({
				success: true,
				message: 'If that email belongs to a LetLetMe account, a code has been sent.'
			})
		} catch (error) {
			return miniProgramErrorResponse(error, 'Failed to send code')
		}
	})
}
