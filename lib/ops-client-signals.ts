import 'server-only'

import type { ClientSignalBatchV1 } from '@/lib/client-signal-contract'
import {
	beginClientSignalForward,
	createClientSignalForwardCircuit,
	recordClientSignalForwardFailure,
	recordClientSignalForwardSuccess
} from '@/lib/ops-client-signal-circuit'

export const DATA_FORWARD_TIMEOUT_MS = 300

const forwardCircuit = createClientSignalForwardCircuit()

function dataBaseUrl(): string {
	return (process.env.LETLETME_DATA_URL ?? '').trim().replace(/\/+$/, '')
}

function dataApiKey(): string {
	return (process.env.LETLETME_DATA_API_KEY ?? '').trim()
}

/** Test-only reset; production code never calls this. */
export function resetClientSignalForwarderForTests(): void {
	recordClientSignalForwardSuccess(forwardCircuit)
}

/** Best-effort forwarder: telemetry failure is never allowed to fail a user request. */
export async function forwardClientSignalBatch(
	batch: ClientSignalBatchV1
): Promise<void> {
	const baseUrl = dataBaseUrl()
	const apiKey = dataApiKey()
	if (!baseUrl || !apiKey) {
		console.warn(
			JSON.stringify({
				event: 'client_signal_forward_skipped',
				reason: 'not_configured'
			})
		)
		return
	}
	if (!beginClientSignalForward(forwardCircuit, Date.now())) {
		console.warn(
			JSON.stringify({
				event: 'client_signal_forward_suppressed',
				reason: 'circuit_open'
			})
		)
		return
	}

	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), DATA_FORWARD_TIMEOUT_MS)
	try {
		const response = await fetch(`${baseUrl}/internal/ops/client-signals`, {
			method: 'POST',
			cache: 'no-store',
			headers: {
				'content-type': 'application/json',
				'x-api-key': apiKey
			},
			signal: controller.signal,
			body: JSON.stringify(batch)
		})
		if (!response.ok) {
			if (
				response.status >= 500 ||
				response.status === 408 ||
				response.status === 429
			) {
				recordClientSignalForwardFailure(forwardCircuit, Date.now())
			} else {
				recordClientSignalForwardSuccess(forwardCircuit)
			}
			console.warn(
				JSON.stringify({
					event: 'client_signal_forward_failed',
					status: response.status
				})
			)
		} else {
			recordClientSignalForwardSuccess(forwardCircuit)
		}
	} catch (error) {
		recordClientSignalForwardFailure(forwardCircuit, Date.now())
		console.warn(
			JSON.stringify({
				event: 'client_signal_forward_failed',
				code:
					error instanceof Error && error.name === 'AbortError'
						? 'timeout'
						: 'transport'
			})
		)
	} finally {
		clearTimeout(timeout)
	}
}
