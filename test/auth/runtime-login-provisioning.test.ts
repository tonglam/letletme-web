import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	assertWebRuntimePasswordRotationAcknowledged,
	assertWebRuntimeLoginSnapshot,
	buildWebRuntimeDatabaseUrl,
	parseWebRuntimeProvisioningArgs,
	WEB_RUNTIME_CAPABILITY,
	WEB_RUNTIME_LOGIN,
	webRuntimePasswordOperation,
	webRuntimePasswordMode,
	verifyWebRuntimeContractWithRetry,
	type WebRuntimeLoginSnapshot
} from '../../scripts/provision-runtime-login'
import { WebDatabaseContractError } from '../../lib/db/runtime-contract'

const capability = () => ({
	roleName: WEB_RUNTIME_CAPABILITY,
	canLogin: false,
	superuser: false,
	createDatabase: false,
	createRole: false,
	inherit: false,
	replication: false,
	bypassRls: false,
	settings: []
})

const login = () => ({
	roleName: WEB_RUNTIME_LOGIN,
	canLogin: true,
	superuser: false,
	createDatabase: false,
	createRole: false,
	inherit: true,
	replication: false,
	bypassRls: false,
	settings: []
})

const accepted = (): WebRuntimeLoginSnapshot => ({
	roles: [capability(), login()],
	memberships: [
		{
			loginRole: WEB_RUNTIME_LOGIN,
			grantedRole: WEB_RUNTIME_CAPABILITY,
			adminOption: false
		}
	],
	ownedObjectCount: 0
})

describe('Web runtime LOGIN provisioning contract', () => {
	it('preserves an existing password unless rotation is explicit and acknowledged', () => {
		assert.deepEqual(parseWebRuntimeProvisioningArgs([]), {
			rotateExistingPassword: false
		})
		assert.equal(webRuntimePasswordOperation(false, false), 'create')
		assert.equal(webRuntimePasswordOperation(true, false), 'preserve')
		assert.equal(webRuntimePasswordOperation(true, true), 'rotate')
		assert.equal(webRuntimePasswordMode('create'), 'create')
		assert.equal(webRuntimePasswordMode('preserve'), 'preserve-existing')
		assert.equal(webRuntimePasswordMode('rotate'), 'rotate-existing')
		assert.throws(() =>
			assertWebRuntimePasswordRotationAcknowledged(true)
		)
		assert.doesNotThrow(() =>
			assertWebRuntimePasswordRotationAcknowledged(
				true,
				'all-clients-stopped'
			)
		)
	})

	it('retries transient post-rotation verification with fresh attempts', async () => {
		let attempts = 0
		const waits: number[] = []
		const result = await verifyWebRuntimeContractWithRetry(
			async () => {
				attempts += 1
				if (attempts < 3) throw new Error('cached Supavisor credential')
				return 'verified'
			},
			{
				retryDelaysMs: [1, 2, 3],
				wait: async milliseconds => {
					waits.push(milliseconds)
				}
			}
		)
		assert.equal(result, 'verified')
		assert.equal(attempts, 3)
		assert.deepEqual(waits, [1, 2])

		let contractAttempts = 0
		await assert.rejects(
			verifyWebRuntimeContractWithRetry(
				async () => {
					contractAttempts += 1
					throw new WebDatabaseContractError(['unsafe runtime role'])
				},
				{ retryDelaysMs: [1], wait: async () => undefined }
			),
			WebDatabaseContractError
		)
		assert.equal(contractAttempts, 1)
	})

	it('rejects unknown or duplicate provisioning arguments', () => {
		assert.throws(() => parseWebRuntimeProvisioningArgs(['--unknown']))
		assert.throws(() =>
			parseWebRuntimeProvisioningArgs([
				'--rotate-existing-password',
				'--rotate-existing-password'
			])
		)
	})

	it('derives a restricted runtime URL without dropping a Supavisor project suffix', () => {
		const runtimeUrl = new URL(
			buildWebRuntimeDatabaseUrl(
				'postgresql://migration.project-ref:admin@pooler.example:6543/postgres?pgbouncer=true',
				'runtime-secret'
			)
		)
		assert.equal(runtimeUrl.username, `${WEB_RUNTIME_LOGIN}.project-ref`)
		assert.equal(runtimeUrl.password, 'runtime-secret')
		assert.equal(runtimeUrl.host, 'pooler.example:6543')
		assert.equal(runtimeUrl.searchParams.get('pgbouncer'), 'true')
	})

	it('accepts one objectless login inheriting one locked capability', () => {
		assert.doesNotThrow(() => assertWebRuntimeLoginSnapshot(accepted()))
	})

	it('rejects elevation, delegation, role settings, and object ownership', () => {
		const elevated = accepted()
		assert.throws(() =>
			assertWebRuntimeLoginSnapshot({
				...elevated,
				roles: elevated.roles.map(role =>
					role.roleName === WEB_RUNTIME_LOGIN
						? { ...role, superuser: true }
						: role
				)
			})
		)

		const delegated = accepted()
		assert.throws(() =>
			assertWebRuntimeLoginSnapshot({
				...delegated,
				memberships: delegated.memberships.map(membership => ({
					...membership,
					adminOption: true
				}))
			})
		)

		const configured = accepted()
		assert.throws(() =>
			assertWebRuntimeLoginSnapshot({
				...configured,
				roles: configured.roles.map(role =>
					role.roleName === WEB_RUNTIME_LOGIN
						? { ...role, settings: ['search_path=public'] }
						: role
				)
			})
		)

		assert.throws(() =>
			assertWebRuntimeLoginSnapshot({
				...accepted(),
				ownedObjectCount: 1
			})
		)
	})
})
