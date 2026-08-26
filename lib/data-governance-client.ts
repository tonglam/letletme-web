import 'server-only'

export type GovernanceWindow = '1h' | '6h' | '3d' | '28d'

export type DataGovernanceOverview = {
	success: boolean
	generatedAt?: string
	window?: GovernanceWindow
	governance?: Record<string, unknown>
	obligations?: unknown
	runtime?: unknown
	publicationConsistency?: Record<string, unknown>
	schedulerProgress?: unknown
	myFplSnapshots?: unknown
	registry?: Array<{
		name?: string
		queueName?: string
		criticality?: string
		contractKey?: string | null
		cadence?: string
	}>
	priceChanges?: unknown
	queues?: unknown[]
	queueHealthWindows?: unknown[]
	freshness?: unknown
	errorBudgetBurn?: unknown
	governanceCases?: unknown[]
	admissions?: unknown[]
	error?: string
}

export class DataGovernanceConfigurationError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'DataGovernanceConfigurationError'
	}
}

export class DataGovernanceUnavailableError extends Error {
	constructor(message = 'Data governance service is unavailable') {
		super(message)
		this.name = 'DataGovernanceUnavailableError'
	}
}

const DATA_API_TIMEOUT_MS = 10_000

const dataApiBaseUrl = (request?: Request): string => {
	const configured = process.env.LETLETME_DATA_URL?.trim() ?? ''
	if (!configured) {
		throw new DataGovernanceConfigurationError(
			'LETLETME_DATA_URL is not configured'
		)
	}
	let url: URL
	try {
		url = new URL(configured)
	} catch {
		throw new DataGovernanceConfigurationError('LETLETME_DATA_URL is invalid')
	}
	if (request && url.origin === new URL(request.url).origin) {
		throw new DataGovernanceConfigurationError(
			'LETLETME_DATA_URL must point to the Data API, not the Web origin'
		)
	}
	return url.toString().replace(/\/$/, '')
}

const normalizeGovernanceOverview = (
	payload: DataGovernanceOverview
): DataGovernanceOverview => {
	// Data keeps the status payload under `governance` so that the API can add
	// envelope fields later. Flatten only the known machine-readable status
	// object; never pass upstream error payloads through to the browser.
	const nested = payload.governance
	return nested && typeof nested === 'object'
		? { ...payload, ...(nested as Partial<DataGovernanceOverview>) }
		: payload
}

async function fetchDataGovernanceEndpoint<T>(
	path: string,
	request?: Request
): Promise<T> {
	const apiKey = process.env.LETLETME_DATA_API_KEY?.trim() ?? ''
	if (!apiKey) {
		throw new DataGovernanceConfigurationError(
			'LETLETME_DATA_API_KEY is not configured'
		)
	}
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), DATA_API_TIMEOUT_MS)
	try {
		const response = await fetch(`${dataApiBaseUrl(request)}${path}`, {
			method: 'GET',
			cache: 'no-store',
			headers: { 'x-api-key': apiKey, accept: 'application/json' },
			signal: controller.signal
		})
		const payload = (await response.json().catch(() => null)) as
			(T & { success?: boolean }) | null
		if (!response.ok || !payload || payload.success === false) {
			throw new DataGovernanceUnavailableError('Data governance request failed')
		}
		return payload as T
	} catch (error) {
		if (error instanceof DataGovernanceConfigurationError) throw error
		if (error instanceof DataGovernanceUnavailableError) throw error
		if (error instanceof Error && error.name === 'AbortError') {
			throw new DataGovernanceUnavailableError(
				'Data governance request timed out'
			)
		}
		throw new DataGovernanceUnavailableError()
	} finally {
		clearTimeout(timeoutId)
	}
}

export async function getDataGovernanceOverview(
	window: GovernanceWindow = '1h',
	request?: Request
): Promise<DataGovernanceOverview> {
	const response = await fetchDataGovernanceEndpoint<DataGovernanceOverview>(
		`/ops/data-governance/overview?window=${encodeURIComponent(window)}`,
		request
	)
	if (!response.success) {
		throw new DataGovernanceUnavailableError('Data governance request failed')
	}
	return normalizeGovernanceOverview(response)
}

export type DataGovernanceWindowsResponse = {
	success: boolean
	windows?: Array<Record<string, unknown>>
}

export type DataGovernanceCasesResponse = {
	success: boolean
	cases?: Array<Record<string, unknown>>
}

export const getDataGovernanceWindows = (
	window: GovernanceWindow = '1h',
	request?: Request
): Promise<DataGovernanceWindowsResponse> =>
	fetchDataGovernanceEndpoint<DataGovernanceWindowsResponse>(
		`/ops/data-governance/windows?limit=100&window=${encodeURIComponent(window)}`,
		request
	)

export const getDataGovernanceCases = (
	request?: Request
): Promise<DataGovernanceCasesResponse> =>
	fetchDataGovernanceEndpoint<DataGovernanceCasesResponse>(
		'/ops/data-governance/cases?limit=100',
		request
	)

export function selectGovernanceContract(
	overview: DataGovernanceOverview,
	contractKey: string
): {
	contractKey: string
	registry: NonNullable<DataGovernanceOverview['registry']>[number] | null
	queues: unknown[]
	obligations: unknown
	freshness: unknown
	governanceCases: unknown[]
	admissions: unknown[]
	generatedAt: string | null
} {
	const registry =
		overview.registry?.find(entry => entry.contractKey === contractKey) ?? null
	const queueNames = new Set(
		(registry?.queueName ? [registry.queueName] : []).filter(
			(value): value is string => typeof value === 'string'
		)
	)
	const queues = (overview.queues ?? []).filter(queue => {
		if (!queue || typeof queue !== 'object') return false
		const name = (queue as { name?: unknown }).name
		return (
			queueNames.size === 0 ||
			(typeof name === 'string' && queueNames.has(name))
		)
	})
	const governanceCases = (overview.governanceCases ?? []).filter(item => {
		if (!item || typeof item !== 'object') return false
		const value = item as { contractKey?: unknown }
		return value.contractKey === contractKey
	})
	return {
		contractKey,
		registry,
		queues,
		obligations: overview.obligations ?? null,
		freshness: overview.freshness ?? null,
		governanceCases,
		admissions: overview.admissions ?? [],
		generatedAt: overview.generatedAt ?? null
	}
}
