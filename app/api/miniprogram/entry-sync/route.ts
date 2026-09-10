import { createHmac } from 'crypto'
import {
	deliverEntrySyncOutboxNow,
	enqueueEntrySyncRequest
} from '@/lib/entry-sync-outbox'
import { parseFplEntryId } from '@/lib/fpl-binding-core'
import {
	buildOpaqueRateLimitSubject,
	checkDatabaseRateLimit,
} from '@/lib/http-security'
import {
	assertValidDeviceId,
	MiniProgramAuthError,
} from '@/lib/miniprogram-account-core'
import {
	miniProgramErrorResponse,
	miniProgramSuccessResponse,
	readMiniProgramJson,
} from '@/lib/miniprogram-route-security'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const ENTRY_SYNC_WINDOW_SECONDS = 60 * 60
const ENTRY_SYNC_MAX = 10

export async function POST(request: Request) {
	try {
		const body = await readMiniProgramJson(request)
		const deviceId = assertValidDeviceId(body.deviceId)
		const entryId = parseFplEntryId(body.entryId)
		if (entryId === null) {
			throw new MiniProgramAuthError('请输入有效的参赛 ID', 400)
		}

		const secret = process.env.BACKEND_PROXY_SECRET
		if (!secret) throw new MiniProgramAuthError('Request safety checks are unavailable', 503)

		const ipRate = await checkDatabaseRateLimit({
			scope: 'mini-entry-sync-ip',
			subject: buildOpaqueRateLimitSubject(request.headers, secret),
			limit: ENTRY_SYNC_MAX,
			windowSeconds: ENTRY_SYNC_WINDOW_SECONDS,
		})
		if (!ipRate.allowed) {
			throw new MiniProgramAuthError('Too many requests', 429, ipRate.retryAfterSeconds)
		}

		const deviceRate = await checkDatabaseRateLimit({
			scope: 'mini-entry-sync-device',
			subject: createHmac('sha256', secret).update(`device:${deviceId}`).digest('hex'),
			limit: ENTRY_SYNC_MAX,
			windowSeconds: ENTRY_SYNC_WINDOW_SECONDS,
		})
		if (!deviceRate.allowed) {
			throw new MiniProgramAuthError('Too many requests', 429, deviceRate.retryAfterSeconds)
		}

		let generation: number
		try {
			generation = await enqueueEntrySyncRequest(entryId)
		} catch {
			throw new MiniProgramAuthError(
				'这次没法同步球队，请稍后再试',
				503,
				60,
				'entry_sync_outbox_unavailable'
			)
		}
		let delivery
		try {
			delivery = await deliverEntrySyncOutboxNow(
				entryId,
				generation,
				new Date(),
				request.signal
			)
		} catch {
			throw new MiniProgramAuthError(
				'这次没法同步球队，请稍后再试',
				503,
				60,
				'entry_sync_outbox_unavailable'
			)
		}
		if (delivery.status !== 'delivered') {
			throw new MiniProgramAuthError(
				'这次没法同步球队，请稍后再试',
				503,
				60,
				'entry_sync_not_queued'
			)
		}
		return miniProgramSuccessResponse({ success: true, queued: true, entryId })
	} catch (error) {
		return miniProgramErrorResponse(error, '这次没法同步球队，请稍后再试')
	}
}
