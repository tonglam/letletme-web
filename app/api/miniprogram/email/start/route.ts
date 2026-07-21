import { startMiniProgramEmailBinding } from '@/lib/miniprogram-account'
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
		await enforceMiniProgramRateLimits({ request, scope: 'email-start', body })
		await startMiniProgramEmailBinding({
			email: body?.email,
			deviceId: body?.deviceId,
		})

		return miniProgramSuccessResponse({
			success: true,
			message: 'If that email belongs to a LetLetMe account, a code has been sent.',
		})
	} catch (error) {
		return miniProgramErrorResponse(error, 'Failed to send code')
	}
}
