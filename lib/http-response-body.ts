import {
	PayloadTooLargeError,
	ResponseReadAbortedError
} from './http-errors'

export { PayloadTooLargeError, ResponseReadAbortedError }

export async function readBoundedResponseBytes(
	response: Response,
	maxBytes: number,
	signal?: AbortSignal
): Promise<Uint8Array> {
	const cancelBody = async (): Promise<void> => {
		try {
			await response.body?.cancel()
		} catch {
			// The boundary error below is more useful than a cancellation cleanup
			// failure, and the fetch body has still been asked to stop.
		}
	}
	if (signal?.aborted) {
		await cancelBody()
		throw new ResponseReadAbortedError()
	}
	const declared = Number(response.headers.get('content-length'))
	if (Number.isFinite(declared) && declared > maxBytes) {
		await cancelBody()
		throw new PayloadTooLargeError(maxBytes)
	}
	if (!response.body) return new Uint8Array()
	const reader = response.body.getReader()
	const chunks: Uint8Array[] = []
	let bytes = 0
	let aborted = false
	const abortReader = () => {
		aborted = true
		void reader.cancel().catch(() => undefined)
	}
	signal?.addEventListener('abort', abortReader, { once: true })
	try {
		for (;;) {
			const { done, value } = await reader.read()
			if (aborted) throw new ResponseReadAbortedError()
			if (done) break
			if (!value) continue
			bytes += value.byteLength
			if (bytes > maxBytes) {
				await reader.cancel().catch(() => undefined)
				throw new PayloadTooLargeError(maxBytes)
			}
			chunks.push(value)
		}
		if (aborted) throw new ResponseReadAbortedError()
	} catch (error) {
		if (aborted) throw new ResponseReadAbortedError()
		await reader.cancel().catch(() => undefined)
		throw error
	} finally {
		signal?.removeEventListener('abort', abortReader)
		reader.releaseLock()
	}
	const result = new Uint8Array(bytes)
	let offset = 0
	for (const chunk of chunks) {
		result.set(chunk, offset)
		offset += chunk.byteLength
	}
	return result
}
