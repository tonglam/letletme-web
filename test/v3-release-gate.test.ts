import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { describe, it } from 'node:test'

import {
	decodeV3ReleaseManifest,
	evaluateV3WebReleaseGate,
	type V3ReleaseManifest,
	type V3WebReleaseGateInput
} from '../scripts/v3-release-gate'

const runId = 'v3-20260808T160008Z-b9eddc0'
const webSha = '3'.repeat(40)
const manifest: V3ReleaseManifest = {
	schemaVersion: 'v3',
	planVersion: '3.2.5',
	status: 'approved',
	cutoverRunId: runId,
	dataSha: '1'.repeat(40),
	graphqlSha: '2'.repeat(40),
	webSha,
	dataImageDigest: `sha256:${'4'.repeat(64)}`,
	graphqlImageDigest: `sha256:${'5'.repeat(64)}`,
	approvedAt: '2026-08-10T00:00:00.000Z'
}
const manifestContents = `${JSON.stringify(manifest, null, 2)}\n`
const manifestSha256 = createHash('sha256')
	.update(manifestContents)
	.digest('hex')

function validInput(
	overrides: Partial<V3WebReleaseGateInput> = {}
): V3WebReleaseGateInput {
	return {
		manifest,
		manifestContents,
		deploySha: webSha,
		cutoverRunId: runId,
		manifestSha256,
		activationApproval: `APPROVE_V3_ACTIVATION ${runId}`,
		...overrides
	}
}

describe('v3 Web release gate', () => {
	it('accepts the exact approved Web SHA', () => {
		assert.deepEqual(evaluateV3WebReleaseGate(validInput()), {
			runId,
			webSha,
			manifestSha256
		})
	})

	it('decodes only canonical base64 JSON', () => {
		assert.deepEqual(
			decodeV3ReleaseManifest(Buffer.from(manifestContents).toString('base64')),
			{ manifest, manifestContents }
		)
		for (const encoded of [undefined, 'not-base64', 'e30']) {
			assert.throws(() => decodeV3ReleaseManifest(encoded))
		}
	})

	it('blocks mismatched release inputs', () => {
		for (const overrides of [
			{ manifest: { ...manifest, status: 'locked' as const } },
			{ deploySha: '6'.repeat(40) },
			{ cutoverRunId: 'v3-20260808T160009Z-b9eddc0' },
			{ manifestSha256: '7'.repeat(64) },
			{ activationApproval: undefined }
		]) {
			assert.throws(() => evaluateV3WebReleaseGate(validInput(overrides)))
		}
	})
})
