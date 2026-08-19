import { getMiniProgramProfileByToken } from '@/lib/miniprogram-account'
import {
	assertValidDeviceId,
	getBearerToken,
	MiniProgramAuthError,
} from '@/lib/miniprogram-account-core'
import {
	miniProgramErrorResponse,
	miniProgramSuccessResponse,
} from '@/lib/miniprogram-route-security'
import { PayloadTooLargeError, readBoundedJson } from '@/lib/http-security'
import {
	BugReportSubmitError,
	enforceBugReportIngressLimit,
	enforceBugReportIpLimit,
	enforceBugReportReporterLimit,
	submitBugReportToData,
} from '@/lib/bug-report-submit'
import { getVerifiedFplEntryId } from '@/lib/fpl-binding-core'

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 3 * 1024 * 1024

function optionalDeviceId(value: unknown): string | null {
	if (typeof value !== 'string') return null
	try {
		return assertValidDeviceId(value)
	} catch {
		return null
	}
}

export async function POST(request: Request) {
	try {
		await enforceBugReportIpLimit(request)

		const token = getBearerToken(request.headers.get('authorization'))
		let userId: string | null = null
		let entryId: number | null = null
		if (token) {
			try {
				const profile = await getMiniProgramProfileByToken(token)
				userId = profile.id
				entryId = getVerifiedFplEntryId(profile)
			} catch (error) {
				if (error instanceof MiniProgramAuthError && error.status === 401) {
					throw new MiniProgramAuthError('登录过期了，请先打开「我」再发', 401)
				}
				throw error
			}
		}

		const bounded = await readBoundedJson(request, MAX_BODY_BYTES)
		if (!bounded || typeof bounded !== 'object' || Array.isArray(bounded)) {
			throw new MiniProgramAuthError('Invalid JSON body', 400)
		}
		const payload = bounded as Record<string, unknown>
		const anonymousId = userId ? null : optionalDeviceId(payload.deviceId)
		if (!userId && !anonymousId) {
			throw new MiniProgramAuthError('这次没法发，请重试', 400)
		}
		const identity = { userId, anonymousId }
		await enforceBugReportIngressLimit(request, identity)
		await enforceBugReportReporterLimit(identity)

		const result = await submitBugReportToData({
			request,
			source: 'wechat_miniprogram',
			userId,
			entryId,
			body: payload.body,
			clientMeta: payload.clientMeta,
			screenshotBase64: payload.screenshotBase64,
			screenshotMime: payload.screenshotMime,
		})
		return miniProgramSuccessResponse({ success: true, publicId: result.publicId })
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return miniProgramErrorResponse(
				new MiniProgramAuthError('Payload too large', 413),
				'Payload too large'
			)
		}
		if (error instanceof BugReportSubmitError) {
			return miniProgramErrorResponse(
				new MiniProgramAuthError(error.message, error.status, error.retryAfterSeconds),
				error.message
			)
		}
		return miniProgramErrorResponse(error, 'Could not send the report.')
	}
}
