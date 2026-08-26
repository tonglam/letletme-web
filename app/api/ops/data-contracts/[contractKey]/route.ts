import { NextResponse } from 'next/server'

import { getAuthorizationSession } from '@/lib/auth'
import { isPlatformAdminIdentity } from '@/lib/platform-admin'
import {
	DataGovernanceConfigurationError,
	DataGovernanceUnavailableError,
	getDataGovernanceOverview,
	selectGovernanceContract,
	type GovernanceWindow
} from '@/lib/data-governance-client'

export const dynamic = 'force-dynamic'

const WINDOW_VALUES = new Set<GovernanceWindow>(['1h', '6h', '3d', '28d'])
const CONTRACT_KEY = /^[a-z0-9][a-z0-9-]{0,63}$/

type RouteContext = { params: Promise<{ contractKey: string }> }

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
