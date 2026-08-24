import { purgeExpiredAuthEvents } from '@/lib/auth-observability'
import { logSafeAuthDiagnostic } from '@/lib/auth-safe-log'

export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
	const secret = process.env.CRON_SECRET
	if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
		return Response.json({ error: 'Unauthorized' }, { status: 401 })
	}

	try {
		const deleted = await purgeExpiredAuthEvents()
		return Response.json({ ok: true, deleted })
	} catch {
		logSafeAuthDiagnostic('warn', 'telemetry_write_failed', {
			code: 'auth_event_cleanup_failed',
			status: 503
		})
		return Response.json({ ok: false }, { status: 503 })
	}
}
