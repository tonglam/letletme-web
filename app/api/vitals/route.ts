import { parseWebVitalPayload } from '@/lib/analytics/web-vitals'
import { PayloadTooLargeError, readBoundedJson } from '@/lib/http-security'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	const origin = request.headers.get('origin')
	const fetchSite = request.headers.get('sec-fetch-site')
	if ((origin && origin !== new URL(request.url).origin) || fetchSite === 'cross-site') {
		return NextResponse.json({ error: 'Cross-site request rejected' }, { status: 403 })
	}

	try {
		const metric = parseWebVitalPayload(await readBoundedJson(request, 4 * 1024))
		if (!metric) {
			return NextResponse.json({ error: 'Invalid web vital payload' }, { status: 400 })
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
