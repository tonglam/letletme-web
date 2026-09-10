import { purgeExpiredAuthEventsBounded } from '@/lib/auth-observability'
import { logSafeAuthDiagnostic } from '@/lib/auth-safe-log'
import { purgeDeliveredEntrySyncOutbox } from '@/lib/entry-sync-outbox'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

async function handle(request: Request): Promise<Response> {
	const secret = process.env.CRON_SECRET
	if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
		return Response.json({ error: 'Unauthorized' }, { status: 401 })
	}

	try {
		const auth = await purgeExpiredAuthEventsBounded({ drain: true })
		const outbox = await purgeDeliveredEntrySyncOutbox()
		return Response.json({
			ok: true,
			auth: {
				deleted: auth.deleted,
				batches: auth.batches,
				stoppedByLimit: auth.stoppedByLimit,
				lockSkipped: auth.lockSkipped,
				remainingExpired: auth.remainingExpired,
				oldestExpiredAt: auth.oldestExpiredAt
			},
			outbox: {
				deleted: outbox.deleted,
				batches: outbox.batches,
				stoppedByLimit: outbox.stoppedByLimit,
				lockSkipped: outbox.lockSkipped,
				remainingDelivered: outbox.remainingDelivered
			}
		})
	} catch {
		logSafeAuthDiagnostic('warn', 'telemetry_write_failed', {
			code: 'auth_event_cleanup_failed',
			status: 503
		})
		return Response.json({ ok: false }, { status: 503 })
	}
}

export async function GET(request: Request): Promise<Response> {
	return handle(request)
}
