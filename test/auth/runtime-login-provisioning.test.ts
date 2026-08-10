import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	assertWebRuntimeLoginSnapshot,
	WEB_RUNTIME_CAPABILITY,
	WEB_RUNTIME_LOGIN,
	type WebRuntimeLoginSnapshot
} from '../../scripts/provision-runtime-login'

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
