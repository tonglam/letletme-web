import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	CAPACITY_RUN_HEADER,
	CAPACITY_RUN_SIGNATURE_HEADER,
	capacityRequestIdForCurrentRun,
	capacityRequestIdForHeaders,
	signCapacityRun,
	verifyCapacityRunHeaders,
	withCapacityRun
} from '../lib/capacity-run'

const secret = 'capacity-test-secret'

const signedHeaders = (runId: string): Headers =>
	new Headers({
		[CAPACITY_RUN_HEADER]: runId,
		[CAPACITY_RUN_SIGNATURE_HEADER]: signCapacityRun(runId, secret)
	})

describe('capacity run correlation', () => {
	it('accepts only bounded correctly signed run identifiers', () => {
		assert.equal(
			verifyCapacityRunHeaders(signedHeaders('capacity_300'), secret),
			'capacity_300'
		)
		const forged = signedHeaders('capacity_300')
		forged.set(CAPACITY_RUN_SIGNATURE_HEADER, 'a'.repeat(43))
		assert.equal(verifyCapacityRunHeaders(forged, secret), null)
		assert.equal(
			verifyCapacityRunHeaders(signedHeaders('bad.run.id'), secret),
			null
		)
	})

	it('creates request IDs that GraphQL can correlate without leaking the signature', () => {
		const requestId = capacityRequestIdForHeaders(
			signedHeaders('capacity_300'),
			secret
		)
		assert.match(requestId ?? '', /^capacity_300-[a-f0-9]{16}$/)
		assert.equal(requestId?.includes(signCapacityRun('capacity_300', secret)), false)
	})

	it('keeps concurrent request contexts isolated', async () => {
		const [left, right] = await Promise.all([
			withCapacityRun('capacity_left', async () => {
				await new Promise(resolve => setImmediate(resolve))
				return capacityRequestIdForCurrentRun()
			}),
			withCapacityRun('capacity_right', async () =>
				capacityRequestIdForCurrentRun()
			)
		])
		assert.match(left ?? '', /^capacity_left-[a-f0-9]{16}$/)
		assert.match(right ?? '', /^capacity_right-[a-f0-9]{16}$/)
		assert.equal(capacityRequestIdForCurrentRun(), null)
	})
})
