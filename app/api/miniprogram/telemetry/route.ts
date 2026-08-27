import { after, NextResponse } from 'next/server'

import { parseClientSignalBatch } from '@/lib/client-signal-contract'
import { forwardClientSignalBatch } from '@/lib/ops-client-signals'
import {
	buildOpaqueRateLimitSubject,
	checkDatabaseRateLimit,
	PayloadTooLargeError,
	readBoundedJson,
} from '@/lib/http-security'

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 16 * 1024
const RATE_LIMIT = 6
const RATE_WINDOW_SECONDS = 60

export async function POST(request: Request) {
	const secret = process.env.BACKEND_PROXY_SECRET?.trim()
	if (!secret && process.env.NODE_ENV === 'production') {
		return NextResponse.json(
			{ accepted: false, error: 'Request safety checks are unavailable' },
			{ status: 503, headers: { 'Cache-Control': 'no-store' } },
		)
	}

	try {
		if (secret) {
			const rate = await checkDatabaseRateLimit({
				scope: 'mini-client-signals-ip',
				subject: buildOpaqueRateLimitSubject(request.headers, secret),
				limit: RATE_LIMIT,
				windowSeconds: RATE_WINDOW_SECONDS,
			})
			if (!rate.allowed) {
				return NextResponse.json(
					{ accepted: false, error: 'Too many telemetry batches' },
					{
						status: 429,
						headers: {
							'Cache-Control': 'no-store',
							'Retry-After': String(rate.retryAfterSeconds),
						},
					},
				)
			}
		}

		const batch = parseClientSignalBatch(await readBoundedJson(request, MAX_BODY_BYTES))
		if (!batch || batch.client !== 'wechat_miniprogram') {
			return NextResponse.json(
				{ accepted: false, error: 'Invalid telemetry payload' },
				{ status: 422, headers: { 'Cache-Control': 'no-store' } },
			)
		}

		after(() => forwardClientSignalBatch(batch))
		return NextResponse.json(
			{ accepted: true },
			{ status: 202, headers: { 'Cache-Control': 'no-store' } },
		)
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return NextResponse.json(
				{ accepted: false, error: 'Payload too large' },
				{ status: 413, headers: { 'Cache-Control': 'no-store' } },
			)
		}
		if (error instanceof SyntaxError) {
			return NextResponse.json(
				{ accepted: false, error: 'Invalid JSON body' },
				{ status: 400, headers: { 'Cache-Control': 'no-store' } },
			)
		}
		if (process.env.NODE_ENV === 'production') {
			console.error('[client signals] ingress unavailable', error instanceof Error ? error.name : 'unknown')
			return NextResponse.json(
				{ accepted: false, error: 'Telemetry ingress unavailable' },
				{ status: 503, headers: { 'Cache-Control': 'no-store' } },
			)
		}
		return NextResponse.json(
			{ accepted: false, error: 'Invalid telemetry request' },
			{ status: 400, headers: { 'Cache-Control': 'no-store' } },
		)
	}
}

