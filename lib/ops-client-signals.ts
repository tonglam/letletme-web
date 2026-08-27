import 'server-only'

import type { ClientSignalBatchV1 } from '@/lib/client-signal-contract'

const DATA_FORWARD_TIMEOUT_MS = 5_000

function dataBaseUrl(): string {
	return (process.env.LETLETME_DATA_URL ?? '').trim().replace(/\/+$/, '')
}

function dataApiKey(): string {
	return (process.env.LETLETME_DATA_API_KEY ?? '').trim()
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
			console.warn(
				JSON.stringify({
					event: 'client_signal_forward_failed',
					status: response.status
				})
			)
		}
	} catch (error) {
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
