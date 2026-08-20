import { AsyncLocalStorage } from 'node:async_hooks'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

const CAPACITY_RUN_PATTERN = /^[A-Za-z0-9_-]{8,32}$/
const CAPACITY_SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/
const CAPACITY_RUN_PURPOSE = 'capacity-run:'

export const CAPACITY_RUN_HEADER = 'x-letletme-capacity-run'
export const CAPACITY_RUN_SIGNATURE_HEADER = 'x-letletme-capacity-sig'

type ReadableHeaders = Pick<Headers, 'get'>

const currentCapacityRun = new AsyncLocalStorage<string>()

export function signCapacityRun(runId: string, secret: string): string {
	return createHmac('sha256', secret)
		.update(`${CAPACITY_RUN_PURPOSE}${runId}`)
		.digest('base64url')
}

export function verifyCapacityRunHeaders(
	headers: ReadableHeaders,
	secret: string
): string | null {
	const runId = headers.get(CAPACITY_RUN_HEADER)
	const provided = headers.get(CAPACITY_RUN_SIGNATURE_HEADER)
	if (
		!runId ||
		!provided ||
		!CAPACITY_RUN_PATTERN.test(runId) ||
		!CAPACITY_SIGNATURE_PATTERN.test(provided)
	) {
		return null
	}
	const expected = Buffer.from(signCapacityRun(runId, secret))
	const actual = Buffer.from(provided)
	return expected.length === actual.length && timingSafeEqual(expected, actual)
		? runId
		: null
}

export function withCapacityRun<T>(
	runId: string | null,
	task: () => Promise<T>
): Promise<T> {
	return runId ? currentCapacityRun.run(runId, task) : task()
}

export async function withCapacityRunForRequest<T>(
	task: () => Promise<T>
): Promise<T> {
	const secret = process.env.BACKEND_PROXY_SECRET?.trim()
	if (!secret) return task()
	const { headers } = await import('next/headers')
	const runId = verifyCapacityRunHeaders(await headers(), secret)
	return withCapacityRun(runId, task)
}

function requestIdForRun(runId: string): string {
	return `${runId}-${randomUUID().replaceAll('-', '').slice(0, 16)}`
}

export function capacityRequestIdForCurrentRun(): string | null {
	const runId = currentCapacityRun.getStore()
	return runId ? requestIdForRun(runId) : null
}

export function capacityRequestIdForHeaders(
	headers: ReadableHeaders,
	secret: string
): string | null {
	const runId = verifyCapacityRunHeaders(headers, secret)
	return runId ? requestIdForRun(runId) : null
}
