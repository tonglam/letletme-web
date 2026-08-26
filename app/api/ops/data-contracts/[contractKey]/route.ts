import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'

import { getAuthorizationSession } from '@/lib/auth'
import { isPlatformAdminIdentity } from '@/lib/platform-admin'
import {
	DataGovernanceConfigurationError,
	DataGovernanceUnavailableError,
	getDataGovernanceOverview,
	selectGovernanceContract,
	type GovernanceWindow
} from '@/lib/data-governance-client'
import {
	DataGovernanceProbeError,
	parseDataGovernanceProbeRequest,
	probeDataContract
} from '@/lib/data-governance-probe'

export const dynamic = 'force-dynamic'

const WINDOW_VALUES = new Set<GovernanceWindow>(['1h', '6h', '3d', '28d'])
const CONTRACT_KEY = /^[a-z0-9][a-z0-9-]{0,63}$/

type RouteContext = { params: Promise<{ contractKey: string }> }

function probeTokenMatches(request: Request): boolean {
	const expected = process.env.DATA_GOVERNANCE_PROBE_TOKEN?.trim() ?? ''
	const provided =
		request.headers.get('x-data-governance-probe-token')?.trim() ?? ''
	if (!expected || !provided) return false
	const expectedBytes = Buffer.from(expected)
	const providedBytes = Buffer.from(provided)
	return (
		expectedBytes.length === providedBytes.length &&
		timingSafeEqual(expectedBytes, providedBytes)
	)
}

export async function GET(request: Request, { params }: RouteContext) {
	const session = await getAuthorizationSession(request.headers).catch(
		() => null
	)
	if (!session?.user || !isPlatformAdminIdentity(session.user)) {
		return NextResponse.json({ error: 'Not found' }, { status: 404 })
	}

	const { contractKey } = await params
	if (!CONTRACT_KEY.test(contractKey)) {
		return NextResponse.json({ error: 'Invalid contract key' }, { status: 400 })
	}
	const requestedWindow =
		new URL(request.url).searchParams.get('window') ?? '1h'
	const window = WINDOW_VALUES.has(requestedWindow as GovernanceWindow)
		? (requestedWindow as GovernanceWindow)
		: null
	if (!window) {
		return NextResponse.json(
			{ error: 'window must be one of 1h, 6h, 3d, 28d' },
			{ status: 400 }
		)
	}

	try {
		const overview = await getDataGovernanceOverview(window, request)
		if (!Array.isArray(overview.registry)) {
			throw new DataGovernanceUnavailableError(
				'Data governance registry evidence is unavailable'
			)
		}
		if (!Array.isArray(overview.queues)) {
			throw new DataGovernanceUnavailableError(
				'Data governance queue evidence is unavailable'
			)
		}
		if (!Array.isArray(overview.governanceCases)) {
			throw new DataGovernanceUnavailableError(
				'Data governance case evidence is unavailable'
			)
		}
		if (!Array.isArray(overview.admissions)) {
			throw new DataGovernanceUnavailableError(
				'Data governance admission evidence is unavailable'
			)
		}
		const contract = selectGovernanceContract(overview, contractKey)
		if (!contract.registry) {
			return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
		}
		return NextResponse.json(
			{ success: true, window, ...contract },
			{ status: 200, headers: { 'cache-control': 'no-store' } }
		)
	} catch (error) {
		const status = error instanceof DataGovernanceConfigurationError ? 503 : 502
		if (!(error instanceof DataGovernanceUnavailableError) && status === 502) {
			console.error('[data-governance] upstream request failed', {
				name: error instanceof Error ? error.name : 'UnknownError'
			})
		}
		return NextResponse.json(
			{ success: false, error: 'Data governance is temporarily unavailable' },
			{ status, headers: { 'cache-control': 'no-store' } }
		)
	}
}

/**
 * Internal Data→GraphQL→Web evidence writer. It is intentionally separate
 * from the platform-admin GET: the Data worker authenticates with a scoped
 * probe token, and the response contains only business revision/count
 * metadata. No session, entry id or raw provider error is exposed.
 */
export async function POST(request: Request, { params }: RouteContext) {
	if (!probeTokenMatches(request)) {
		return NextResponse.json(
			{ success: false, error: 'Not found' },
			{ status: 404 }
		)
	}
	const { contractKey } = await params
	if (!CONTRACT_KEY.test(contractKey)) {
		return NextResponse.json(
			{ success: false, error: 'Invalid contract key' },
			{ status: 400 }
		)
	}
	const contentLength = Number(request.headers.get('content-length') ?? '0')
	if (Number.isFinite(contentLength) && contentLength > 32_768) {
		return NextResponse.json(
			{ success: false, error: 'Request too large' },
			{ status: 413 }
		)
	}
	try {
		const body = parseDataGovernanceProbeRequest(await request.json())
		if (body.contractKey !== contractKey) {
			return NextResponse.json(
				{ success: false, error: 'Contract mismatch' },
				{ status: 400 }
			)
		}
		const result = await probeDataContract(body)
		return NextResponse.json(result, {
			status: 200,
			headers: { 'cache-control': 'no-store' }
		})
	} catch (error) {
		if (error instanceof DataGovernanceProbeError) {
			const status = error.code === 'INVALID_REQUEST' ? 400 : 503
			return NextResponse.json(
				{ success: false, error: error.code },
				{ status, headers: { 'cache-control': 'no-store' } }
			)
		}
		return NextResponse.json(
			{ success: false, error: 'BUSINESS_DATA_UNAVAILABLE' },
			{ status: 503, headers: { 'cache-control': 'no-store' } }
		)
	}
}
