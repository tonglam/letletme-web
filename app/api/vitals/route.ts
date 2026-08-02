import { parseWebVitalPayload } from '@/lib/analytics/web-vitals'
import {
	buildOpaqueRateLimitSubject,
	checkDatabaseRateLimit,
	PayloadTooLargeError,
	readBoundedJson,
} from '@/lib/http-security'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	const origin = request.headers.get('origin')
	const fetchSite = request.headers.get('sec-fetch-site')
	if ((origin && origin !== new URL(request.url).origin) || fetchSite === 'cross-site') {
		return NextResponse.json({ error: 'Cross-site request rejected' }, { status: 403 })
	}

	const secret = process.env.BACKEND_PROXY_SECRET
	if (!secret && process.env.NODE_ENV === 'production') {
		return NextResponse.json({ error: 'Request safety checks are unavailable' }, { status: 503 })
	}

	try {
		const metric = parseWebVitalPayload(await readBoundedJson(request, 4 * 1024))
		if (!metric) {
			return NextResponse.json({ error: 'Invalid web vital payload' }, { status: 400 })
		}

		if (secret) {
			try {
				const rate = await checkDatabaseRateLimit({
					scope: 'web-vitals-ingest-ip',
					subject: buildOpaqueRateLimitSubject(request.headers, secret),
					limit: 120,
					windowSeconds: 60,
				})
				if (!rate.allowed) {
					return NextResponse.json(
						{ error: 'Too many web vital reports' },
						{ status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
					)
				}
			} catch (error) {
				if (process.env.NODE_ENV === 'production') {
					console.error('[web vitals] Rate-limit storage unavailable:', error)
					return NextResponse.json({ error: 'Request safety checks are unavailable' }, { status: 503 })
				}
				console.warn('[web vitals] Rate-limit storage unavailable; development request allowed')
			}
		}

		console.info(JSON.stringify({
			event: 'web_vital',
			...metric,
			release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? 'local',
			recordedAt: new Date().toISOString(),
		}))
		return new NextResponse(null, { status: 204 })
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
		}
		if (error instanceof SyntaxError) {
			return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
		}
		console.error('[web vitals] Failed to record metric:', error)
		return NextResponse.json({ error: 'Metric could not be recorded' }, { status: 500 })
	}
}
