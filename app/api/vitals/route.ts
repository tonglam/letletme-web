import {
	parseClientRuntimePayload,
	parseWebVitalPayload,
	type ClientRuntimePayload,
	type WebVitalPayload
} from '@/lib/analytics/web-vitals'
import {
	buildOpaqueRateLimitSubject,
	checkDatabaseRateLimit,
	PayloadTooLargeError,
	readBoundedJson
} from '@/lib/http-security'
import { isTrustedSameSiteRequest } from '@/lib/request-origin'
import type {
	ClientSignalBatchV1,
	ClientSignalDeviceGroup,
	ClientSignalSurface,
	ClientSignalMetric
} from '@/lib/client-signal-contract'
import { parseClientSignalBatch } from '@/lib/client-signal-contract'
import { forwardClientSignalBatch } from '@/lib/ops-client-signals'
import { randomUUID } from 'node:crypto'
import { after, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	if (!isTrustedSameSiteRequest(request)) {
		return NextResponse.json(
			{ error: 'Cross-site request rejected' },
			{ status: 403, headers: { 'Cache-Control': 'no-store' } }
		)
	}

	const secret = process.env.BACKEND_PROXY_SECRET
	if (!secret && process.env.NODE_ENV === 'production') {
		return NextResponse.json(
			{ error: 'Request safety checks are unavailable' },
			{ status: 503 }
		)
	}

	try {
		const input = await readBoundedJson(request, 4 * 1024)
		const metric = parseWebVitalPayload(input)
		const runtime = metric ? null : parseClientRuntimePayload(input)
		const clientBatch = metric || runtime ? null : parseClientSignalBatch(input)
		if (!metric && !runtime && clientBatch?.client !== 'web') {
			return NextResponse.json(
				{ error: 'Invalid client telemetry payload' },
				{ status: 400 }
			)
		}

		if (secret) {
			try {
				const rate = await checkDatabaseRateLimit({
					scope: 'web-vitals-ingest-ip',
					subject: buildOpaqueRateLimitSubject(request.headers, secret),
					limit: 120,
					windowSeconds: 60
				})
				if (!rate.allowed) {
					return NextResponse.json(
						{ error: 'Too many web vital reports' },
						{
							status: 429,
							headers: { 'Retry-After': String(rate.retryAfterSeconds) }
						}
					)
				}
			} catch (error) {
				if (process.env.NODE_ENV === 'production') {
					console.error('[web vitals] Rate-limit storage unavailable:', error)
					return NextResponse.json(
						{ error: 'Request safety checks are unavailable' },
						{ status: 503 }
					)
				}
				console.warn(
					'[web vitals] Rate-limit storage unavailable; development request allowed'
				)
			}
		}

		const signal = metric
			? toClientSignal(metric)
			: runtime
				? toRuntimeSignal(runtime)
				: clientBatch
		if (signal) after(() => forwardClientSignalBatch(signal))
		if (metric) {
			// Keep the existing validated metric log as a best-effort local
			// diagnostic when Data forwarding is unavailable or intentionally
			// omitted (for example, an unknown rollout source).
			console.info(
				JSON.stringify({
					event: 'web_vital',
					...metric,
					release: releaseName(),
					recordedAt: new Date().toISOString(),
					forwarded: signal !== null
				})
			)
		} else if (runtime) {
			console.info(
				JSON.stringify({
					event: 'client_runtime_signal',
					client: 'web',
					metric: 'runtime_error',
					surface: surfaceForPage(runtime?.page ?? ''),
					deviceGroup: runtime?.device ?? 'unknown',
					sampleSource: runtime?.source ?? 'unknown',
					release: releaseName(),
					recordedAt: new Date().toISOString(),
					forwarded: signal !== null
				})
			)
		} else {
			console.info(
				JSON.stringify({
					event: 'client_telemetry_batch',
					client: 'web',
					sampleCount: clientBatch?.samples.length ?? 0,
					release: releaseName(),
					recordedAt: new Date().toISOString(),
					forwarded: signal !== null
				})
			)
		}
		return new NextResponse(null, { status: 204 })
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
		}
		if (error instanceof SyntaxError) {
			return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
		}
		console.error('[web vitals] Failed to record metric:', error)
		return NextResponse.json(
			{ error: 'Metric could not be recorded' },
			{ status: 500 }
		)
	}
}

function releaseName(): string {
	const release =
		process.env.LETLETME_RELEASE_SHA?.trim() ||
		process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
		'local'
	return release.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 64) || 'local'
}

function surfaceForPage(page: string): ClientSignalSurface {
	if (page.includes('/live/matches')) return 'live_matches'
	if (page.includes('/live/points')) return 'live_entry'
	if (page.includes('/live/competitions')) return 'live_entry'
	if (page.includes('/live/')) return 'live_match'
	if (page.includes('price')) return 'price_changes'
	if (page.includes('player')) return 'player_stats'
	if (page.includes('fixture')) return 'fixtures'
	if (page.includes('my-fpl') || page.includes('my_fpl')) return 'my_fpl'
	if (page === '/' || page.endsWith('/home')) return 'home'
	return 'other'
}

function metricForWebVital(name: string): ClientSignalMetric | null {
	if (name === 'LCP') return 'lcp_ms'
	if (name === 'INP') return 'inp_ms'
	if (name === 'CLS') return 'cls'
	if (!['FCP', 'FID', 'TTFB'].includes(name)) return 'route_ready_ms'
	return null
}

function signalSource(
	source: WebVitalPayload['source'] | ClientRuntimePayload['source']
): 'real' | 'synthetic' | null {
	if (source === 'synthetic') return 'synthetic'
	if (source === 'user') return 'real'
	return null
}

function toClientSignal(metric: WebVitalPayload): ClientSignalBatchV1 | null {
	const metricName = metricForWebVital(metric.name)
	const sampleSource = signalSource(metric.source)
	if (!metricName || !sampleSource) return null
	const deviceGroup: ClientSignalDeviceGroup =
		metric.device === 'mobile' ||
		metric.device === 'tablet' ||
		metric.device === 'desktop'
			? metric.device
			: 'unknown'
	return {
		schemaVersion: 1,
		batchId: randomUUID(),
		client: 'web',
		release: releaseName(),
		sentAt: new Date().toISOString(),
		samples: [
			{
				observedAt: new Date().toISOString(),
				surface: surfaceForPage(metric.page),
				metric: metricName,
				deviceGroup,
				sampleSource,
				result: 'ok',
				value: metric.value
			}
		]
	}
}

function toRuntimeSignal(
	runtime: ClientRuntimePayload
): ClientSignalBatchV1 | null {
	const sampleSource = signalSource(runtime.source)
	if (!sampleSource) return null
	return {
		schemaVersion: 1,
		batchId: randomUUID(),
		client: 'web',
		release: releaseName(),
		sentAt: new Date().toISOString(),
		samples: [
			{
				observedAt: new Date().toISOString(),
				surface: surfaceForPage(runtime.page),
				metric: 'runtime_error',
				deviceGroup: runtime.device,
				sampleSource,
				result: 'error'
			}
		]
	}
}
