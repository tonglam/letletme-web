import assert from 'node:assert/strict'
import test from 'node:test'

import { auditWebDatabaseContract } from '../instrumentation'

test('database contract audit is silent after a successful validation', async () => {
	const messages: string[] = []

	await auditWebDatabaseContract(async () => undefined, message => messages.push(message))

	assert.deepEqual(messages, [])
})

test('database contract audit records a transient failure without rejecting startup', async () => {
	const messages: string[] = []

	await assert.doesNotReject(() =>
		auditWebDatabaseContract(
			async () => {
				throw new Error('write CONNECT_TIMEOUT pooler.example:6543')
			},
			message => messages.push(message),
		),
	)
	assert.deepEqual(messages, [
		'[web-database-contract] background audit failed: write CONNECT_TIMEOUT pooler.example:6543\n',
	])
})
