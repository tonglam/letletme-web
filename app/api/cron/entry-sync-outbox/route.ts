import {
	getEntrySyncOutboxHealth,
	getEntrySyncOutboxMonitorHealth,
	processEntrySyncOutbox
} from '@/lib/entry-sync-outbox'
import { logSafeAuthDiagnostic } from '@/lib/auth-safe-log'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function authorized(request: Request): boolean {
	const secret = process.env.CRON_SECRET
	return Boolean(
		secret && request.headers.get('authorization') === `Bearer ${secret}`
	)
}

export async function GET(request: Request): Promise<Response> {
	if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
	try {
		const health = new URL(request.url).searchParams.get('view') === 'monitor'
			? await getEntrySyncOutboxMonitorHealth()
			: await getEntrySyncOutboxHealth()
		return Response.json({ success: true, outbox: health })
	} catch {
		logSafeAuthDiagnostic('warn', 'entry_sync_outbox_health_failed', {
			code: 'entry_sync_outbox_health_failed',
			status: 503
		})
		return Response.json({ success: false }, { status: 503 })
	}
}

export async function POST(request: Request): Promise<Response> {
	if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
	try {
		const result = await processEntrySyncOutbox()
		// The timer is the frequent caller of this endpoint.  Its response is
		// operational evidence, not the seven-day cleanup report; do not make a
		// successful processing run scan retained delivered rows just to format
		// the response.
		const health = await getEntrySyncOutboxMonitorHealth()
		return Response.json({ success: true, result, outbox: health })
	} catch {
		logSafeAuthDiagnostic('warn', 'entry_sync_outbox_run_failed', {
			code: 'entry_sync_outbox_run_failed',
			status: 503
		})
		return Response.json({ success: false }, { status: 503 })
	}
}
