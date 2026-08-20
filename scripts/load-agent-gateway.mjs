import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const DEFAULT_CLIENTS = 20
const DEFAULT_DURATION_SECONDS = 10 * 60
const REQUEST_INTERVAL_MS = 1_000

const sleep = milliseconds =>
	new Promise(resolve => globalThis.setTimeout(resolve, Math.max(0, milliseconds)))

export function nextRequestDelayMs(finishedAt, endsAt, intervalMs = REQUEST_INTERVAL_MS) {
	return finishedAt + intervalMs >= endsAt ? null : intervalMs
}

export function parsePositiveInteger(value, fallback, name) {
	if (value === undefined || value === '') return fallback
	const parsed = Number(value)
	if (!Number.isSafeInteger(parsed) || parsed <= 0) {
		throw new Error(`${name} must be a positive integer`)
	}
	return parsed
}

export function percentile(values, quantile) {
	if (values.length === 0) return null
	const sorted = [...values].sort((left, right) => left - right)
	const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)
	return Number(sorted[Math.max(0, index)].toFixed(2))
}

export function resolveLoadCookies(env) {
	if (env.AGENT_LOAD_COOKIES_JSON) {
		let parsed
		try {
			parsed = JSON.parse(env.AGENT_LOAD_COOKIES_JSON)
		} catch {
			throw new Error('AGENT_LOAD_COOKIES_JSON must be valid JSON')
		}
		if (
			!Array.isArray(parsed) ||
			parsed.length === 0 ||
			parsed.some(cookie => typeof cookie !== 'string' || cookie.trim().length === 0)
		) {
			throw new Error('AGENT_LOAD_COOKIES_JSON must be a non-empty array of cookie strings')
		}
		return parsed.map(cookie => cookie.trim())
	}
	const cookie = env.AGENT_LOAD_COOKIE?.trim()
	if (!cookie) {
		throw new Error('Set AGENT_LOAD_COOKIE or AGENT_LOAD_COOKIES_JSON')
	}
	return [cookie]
}

export function resolveEndpoint(value) {
	if (!value) throw new Error('Set AGENT_LOAD_BASE_URL explicitly')
	const url = new URL('/api/agent/v1/tools/letletme_context', value)
	const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
	if (url.protocol !== 'https:' && !localHttp) {
		throw new Error('AGENT_LOAD_BASE_URL must use HTTPS (HTTP is allowed only for localhost)')
	}
	url.search = ''
	url.hash = ''
	return url
}

export function summarize(samples, durationSeconds, clients, sessionCount) {
	const statusCounts = {}
	let networkErrors = 0
	let invalidBodies = 0
	for (const sample of samples) {
		if (sample.status === null) networkErrors += 1
		else statusCounts[sample.status] = (statusCounts[sample.status] ?? 0) + 1
		if (!sample.bodyValid) invalidBodies += 1
	}
	const unexpectedStatuses = Object.entries(statusCounts)
		.filter(([status]) => !['200', '429'].includes(status))
		.reduce((total, [, count]) => total + count, 0)
	const unexpectedErrors = samples.filter(
		sample =>
			sample.status === null ||
			![200, 429].includes(sample.status) ||
			!sample.bodyValid
	).length
	return {
		clients,
		sessionCount,
		durationSeconds,
		requests: samples.length,
		statusCounts,
		networkErrors,
		invalidBodies,
		unexpectedStatuses,
		unexpectedErrorRate:
			samples.length === 0 ? 1 : Number((unexpectedErrors / samples.length).toFixed(6)),
		latencyMs: {
			p50: percentile(samples.map(sample => sample.durationMs), 0.5),
			p95: percentile(samples.map(sample => sample.durationMs), 0.95),
			max:
				samples.length === 0
					? null
					: Number(Math.max(...samples.map(sample => sample.durationMs)).toFixed(2))
		}
	}
}

async function requestContext(endpoint, cookie, clientIndex, fetcher) {
	const startedAt = performance.now()
	try {
		const response = await fetcher(endpoint, {
			method: 'POST',
			redirect: 'error',
			headers: {
				'Content-Type': 'application/json',
				Cookie: cookie,
				'X-Request-Id': `agent-load-${clientIndex}-${randomUUID()}`
			},
			body: '{}'
		})
		let bodyValid = false
		try {
			const body = await response.json()
			bodyValid =
				(response.status === 200 &&
					body?.schemaVersion === '1' &&
					body?.tool === 'letletme_context') ||
				(response.status === 429 && body?.code === 'RATE_LIMITED')
		} catch {
			bodyValid = false
		}
		return {
			status: response.status,
			bodyValid,
			durationMs: performance.now() - startedAt
		}
	} catch {
		return { status: null, bodyValid: true, durationMs: performance.now() - startedAt }
	}
}

export async function runLoadTest({
	endpoint,
	cookies,
	clients = DEFAULT_CLIENTS,
	durationSeconds = DEFAULT_DURATION_SECONDS,
	fetcher = globalThis.fetch
}) {
	const samples = []
	const endsAt = performance.now() + durationSeconds * 1_000
	await Promise.all(
		Array.from({ length: clients }, async (_, clientIndex) => {
			const cookie = cookies[clientIndex % cookies.length]
			while (performance.now() < endsAt) {
				samples.push(await requestContext(endpoint, cookie, clientIndex, fetcher))
				const delayMs = nextRequestDelayMs(performance.now(), endsAt)
				if (delayMs === null) break
				await sleep(delayMs)
			}
		})
	)
	return summarize(samples, durationSeconds, clients, cookies.length)
}

async function main() {
	const endpoint = resolveEndpoint(process.env.AGENT_LOAD_BASE_URL)
	const cookies = resolveLoadCookies(process.env)
	const clients = parsePositiveInteger(
		process.env.AGENT_LOAD_CLIENTS,
		DEFAULT_CLIENTS,
		'AGENT_LOAD_CLIENTS'
	)
	const durationSeconds = parsePositiveInteger(
		process.env.AGENT_LOAD_DURATION_SECONDS,
		DEFAULT_DURATION_SECONDS,
		'AGENT_LOAD_DURATION_SECONDS'
	)
	console.info(
		JSON.stringify({
			event: 'agent_gateway_load_start',
			origin: endpoint.origin,
			clients,
			sessionCount: cookies.length,
			durationSeconds,
			requestsPerClientPerSecond: 1
		})
	)
	const summary = await runLoadTest({ endpoint, cookies, clients, durationSeconds })
	console.info(JSON.stringify({ event: 'agent_gateway_load_complete', ...summary }))
	if (summary.unexpectedErrorRate >= 0.01) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch(error => {
		console.error(
			JSON.stringify({
				event: 'agent_gateway_load_failed',
				message: error instanceof Error ? error.message : 'Unknown load test failure'
			})
		)
		process.exitCode = 1
	})
}
