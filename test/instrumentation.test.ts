import assert from 'node:assert/strict'
import test from 'node:test'

import { auditWebDatabaseContract } from '../instrumentation'
import {
	WebDatabaseContractAuditTimeoutError,
	WebDatabaseContractError
} from '../lib/db/runtime-contract'

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

test('database contract audit degrades only recognized transient failures', async () => {
	for (const error of [
		Object.assign(new Error('connection reset'), { code: 'ECONNRESET' }),
		Object.assign(new Error('canceling statement due to statement timeout'), {
			code: '57014'
		}),
		Object.assign(new Error('terminating connection due to administrator command'), {
			code: '57P01'
		}),
		Object.assign(new Error('database is starting'), { code: '57P03' }),
		new WebDatabaseContractAuditTimeoutError(2_000)
	]) {
		await assert.doesNotReject(() =>
			auditWebDatabaseContract(
				async () => {
					throw error
				},
				() => undefined
			)
		)
	}
})

test('database contract audit rejects permanent operational failures', async () => {
	for (const error of [
		new TypeError('Invalid URL'),
		Object.assign(new Error('password authentication failed'), { code: '28P01' }),
		Object.assign(new Error('database does not exist'), { code: '3D000' }),
		Object.assign(new Error('self signed certificate in certificate chain'), {
			code: 'SELF_SIGNED_CERT_IN_CHAIN'
		})
	]) {
		await assert.rejects(
			auditWebDatabaseContract(async () => {
				throw error
			}),
			candidate => candidate === error
		)
	}
})

test('database contract audit still rejects an unsafe runtime identity', async () => {
	await assert.rejects(
		auditWebDatabaseContract(async () => {
			throw new WebDatabaseContractError(['runtime role has elevated privileges'])
		}),
		WebDatabaseContractError
	)
})
