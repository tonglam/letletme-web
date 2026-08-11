import assert from 'node:assert/strict'
import test from 'node:test'

import postgres from 'postgres'

import {
	fingerprintAuthContract,
	loadAuthMappingContract
} from '../../scripts/auth-schema-contract'

const integrationEnabled =
	process.env.RUN_SCHEMA_DECLARATION_PARITY === 'true' &&
	Boolean(process.env.DIRECT_DATABASE_URL) &&
	Boolean(process.env.SCHEMA_EXPORT_DATABASE_URL)

test(
	'Drizzle Auth declarations equal the canonical baseline catalog',
	{ skip: !integrationEnabled },
	async () => {
		const baseline = postgres(process.env.DIRECT_DATABASE_URL!, {
			max: 1,
			prepare: false
		})
		const declaration = postgres(process.env.SCHEMA_EXPORT_DATABASE_URL!, {
			max: 1,
			prepare: false
		})
		try {
			const baselineContract = await loadAuthMappingContract(baseline)
			const declarationContract = await loadAuthMappingContract(declaration)
			assert.equal(baselineContract.length, 114)
			assert.deepEqual(declarationContract, baselineContract)
			assert.equal(
				fingerprintAuthContract(declarationContract),
				fingerprintAuthContract(baselineContract)
			)
		} finally {
			await Promise.all([baseline.end(), declaration.end()])
		}
	}
)
