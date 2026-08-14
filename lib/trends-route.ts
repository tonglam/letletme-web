import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { getVerifiedEntryContext } from '@/lib/session'
import { loadTrendCohorts, loadTrendDesk } from '@/lib/trends-server'

export const TRENDS_PUBLIC_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300, no-transform'
export const TRENDS_PRIVATE_CACHE_CONTROL = 'private, no-store'

const jsonError = (message: string, status: number, cache = TRENDS_PRIVATE_CACHE_CONTROL) =>
	NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': cache } })

function parseDeskParams(request: Request) {
	const params = new URL(request.url).searchParams
	const cohortId = params.get('cohortId') ?? ''
	const eventId = Number(params.get('eventId'))
	const limit = Number(params.get('limit') ?? 12)
	if (!/^competition:[1-9][0-9]*$/.test(cohortId) || !Number.isInteger(eventId) || eventId < 1 || eventId > 38 || !Number.isInteger(limit) || limit < 1 || limit > 12) return null
	return { cohortId, eventId, limit }
}

function etag(value: unknown) {
	return `"${createHash('sha1').update(JSON.stringify(value)).digest('hex')}"`
}

function upstreamStatus(error: unknown) {
	if (!error || typeof error !== 'object') return 502
	const candidate = error as { status?: unknown; extensions?: { http?: { status?: unknown } } }
	const status = Number(candidate.status ?? candidate.extensions?.http?.status)
	return status === 404 || status === 401 || status === 403 ? status : 502
}

export async function publicDeskRoute(request: Request) {
	const parsed = parseDeskParams(request)
	if (!parsed) return jsonError('Invalid Trends desk parameters', 400)
	const startedAt = performance.now()
	try {
		const data = { trendCohortSnapshot: await loadTrendDesk(parsed.cohortId, parsed.eventId, 'PUBLIC', null, parsed.limit) }
		console.info('[trends] public desk ready', { cohortId: parsed.cohortId, eventId: parsed.eventId, durationMs: Number((performance.now() - startedAt).toFixed(2)) })
		const response = NextResponse.json(data, { headers: { 'Cache-Control': TRENDS_PUBLIC_CACHE_CONTROL, ETag: etag(data) } })
		if (request.headers.get('if-none-match') === response.headers.get('etag')) return new NextResponse(null, { status: 304, headers: { 'Cache-Control': TRENDS_PUBLIC_CACHE_CONTROL, ETag: response.headers.get('etag')! } })
		return response
	} catch (error) {
		console.error('[trends] public desk failed', { cohortId: parsed.cohortId, eventId: parsed.eventId, durationMs: Number((performance.now() - startedAt).toFixed(2)), error: error instanceof Error ? error.name : 'UnknownError' })
		const status = upstreamStatus(error)
		return jsonError(status === 404 ? 'Trends cohort not found' : 'Trends desk is temporarily unavailable', status)
	}
}

export async function myDeskRoute(request: Request) {
	const parsed = parseDeskParams(request)
	if (!parsed) return jsonError('Invalid Trends desk parameters', 400)
	const { session, entryId } = await getVerifiedEntryContext()
	if (!session || !entryId) return jsonError('Authentication required', 401)
	try {
		const startedAt = performance.now()
		const data = { trendCohortSnapshot: await loadTrendDesk(parsed.cohortId, parsed.eventId, 'MINE', session, parsed.limit) }
		console.info('[trends] private desk ready', { cohortId: parsed.cohortId, eventId: parsed.eventId, durationMs: Number((performance.now() - startedAt).toFixed(2)) })
		return NextResponse.json(data, { headers: { 'Cache-Control': TRENDS_PRIVATE_CACHE_CONTROL } })
	} catch (error) {
		const status = upstreamStatus(error)
		return jsonError(status === 404 ? 'Trends cohort not found' : 'Trends desk is temporarily unavailable', status)
	}
}

export async function myCohortsRoute() {
	const { session, entryId } = await getVerifiedEntryContext()
	if (!session || !entryId) return jsonError('Authentication required', 401)
	try {
		return NextResponse.json(await loadTrendCohorts('MINE', session), { headers: { 'Cache-Control': TRENDS_PRIVATE_CACHE_CONTROL } })
	} catch {
		return jsonError('My Trends cohorts are temporarily unavailable', 502)
	}
}
