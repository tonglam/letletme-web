import assert from 'node:assert/strict'
import test from 'node:test'

import { auditWebDatabaseContract } from '../instrumentation'
import { WebDatabaseContractError } from '../lib/db/runtime-contract'

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
		'[web-database-contract] transient startup audit failed: write CONNECT_TIMEOUT pooler.example:6543\n',
	])
})

test('database contract audit still rejects an unsafe runtime identity', async () => {
	await assert.rejects(
		auditWebDatabaseContract(async () => {
			throw new WebDatabaseContractError(['runtime role has elevated privileges'])
		}),
		WebDatabaseContractError
	)
})
