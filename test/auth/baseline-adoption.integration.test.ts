import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test, { after, before, describe } from 'node:test'

import postgres from 'postgres'

import {
	adoptProductionAuthBaseline,
	PRODUCTION_AUTH_BASELINE_EXPECTATIONS
} from '../../scripts/auth-baseline-adoption'
import {
	fingerprintAuthDataManifest,
	loadAuthDataManifest
} from '../../scripts/auth-data-contract'
import { loadLocalMigrations } from '../../scripts/migration-audit'

const integrationEnabled =
	process.env.RUN_BASELINE_ADOPTION_INTEGRATION === 'true' &&
	Boolean(process.env.DIRECT_DATABASE_URL)

const integrationTest = integrationEnabled ? test : test.skip
const databaseUrl = process.env.DIRECT_DATABASE_URL ?? ''
const sql = integrationEnabled
	? postgres(databaseUrl, { max: 1, prepare: false })
	: null

let baselineHash = ''
let baselineTimestamp = 0
let productionLedgerFixture = ''
const PRESERVED_USER_ID = 'baseline-adoption-preserved-user'

async function currentDataFingerprint(): Promise<string> {
	assert.ok(sql)
	return fingerprintAuthDataManifest(await loadAuthDataManifest(sql))
}

async function installProductionLedger(
	transaction: postgres.TransactionSql
): Promise<void> {
	await transaction`TRUNCATE TABLE bauth.__drizzle_migrations RESTART IDENTITY`
	await transaction.unsafe(productionLedgerFixture)
}

async function expectCanonicalLedger(): Promise<void> {
	assert.ok(sql)
	const rows = await sql<
		{ id: number; hash: string; created_at: string | null }[]
	>`
		SELECT id, hash, created_at::text
		FROM bauth.__drizzle_migrations
		ORDER BY id
	`
	assert.deepEqual(rows.map(row => ({ ...row })), [
		{
			id: 1,
			hash: baselineHash,
			created_at: String(baselineTimestamp)
		}
	])
}

before(async () => {
	if (!integrationEnabled) return
	const local = await loadLocalMigrations()
	const baseline = local.migrations[0]
	assert.equal(baseline?.tag, '0000_auth_baseline')
	baselineHash = baseline.hash
	baselineTimestamp = baseline.when
	productionLedgerFixture = await readFile(
		'test/fixtures/auth-production-ledger.sql',
		'utf8'
	)
	assert.ok(sql)
	await sql`DELETE FROM bauth."user" WHERE id = ${PRESERVED_USER_ID}`
	await sql`
		INSERT INTO bauth."user" (id, email, name)
		VALUES (
			${PRESERVED_USER_ID},
			'baseline-preserved@example.test',
			'Baseline preserved user'
		)
	`
})

after(async () => {
	if (!sql) return
	await sql`DELETE FROM bauth."user" WHERE id = ${PRESERVED_USER_ID}`
	await sql.end()
})

describe('canonical Auth baseline adoption', () => {
	integrationTest(
		'replaces the accepted production ledger without changing Auth data',
		async () => {
			assert.ok(sql)
			const dataFingerprint = await currentDataFingerprint()
			await sql.begin(async transaction => {
				await installProductionLedger(transaction)
				await adoptProductionAuthBaseline(
					transaction,
					baselineHash,
					baselineTimestamp,
					{
						...PRODUCTION_AUTH_BASELINE_EXPECTATIONS,
						dataFingerprint
					}
				)
			})

			await expectCanonicalLedger()
			assert.equal(await currentDataFingerprint(), dataFingerprint)
			const [preserved] = await sql<
				{ email: string | null; name: string | null }[]
			>`
				SELECT email, name FROM bauth."user" WHERE id = ${PRESERVED_USER_ID}
			`
			assert.deepEqual(
				preserved,
				{
					email: 'baseline-preserved@example.test',
					name: 'Baseline preserved user'
				}
			)
		}
	)

	integrationTest(
		'rolls back when the production ledger checksum differs',
		async () => {
			assert.ok(sql)
			const dataFingerprint = await currentDataFingerprint()
			await assert.rejects(
				sql.begin(async transaction => {
					await installProductionLedger(transaction)
					await transaction`
						UPDATE bauth.__drizzle_migrations
						SET hash = repeat('0', 64)
						WHERE created_at = 1786435200000
					`
					await adoptProductionAuthBaseline(
						transaction,
						baselineHash,
						baselineTimestamp,
						{
							...PRODUCTION_AUTH_BASELINE_EXPECTATIONS,
							dataFingerprint
						}
					)
				}),
				/production Web migration ledger/i
			)
			await expectCanonicalLedger()
		}
	)

	integrationTest(
		'rolls back on extra objects or ACL drift',
		async () => {
			assert.ok(sql)
			const dataFingerprint = await currentDataFingerprint()
			for (const drift of [
				async (transaction: postgres.TransactionSql) =>
					transaction`CREATE TABLE bauth.unexpected_relation (id integer PRIMARY KEY)`,
				async (transaction: postgres.TransactionSql) =>
					transaction`GRANT SELECT ON bauth.session TO anon`
			]) {
				await assert.rejects(
					sql.begin(async transaction => {
						await installProductionLedger(transaction)
						await drift(transaction)
						await adoptProductionAuthBaseline(
							transaction,
							baselineHash,
							baselineTimestamp,
							{
								...PRODUCTION_AUTH_BASELINE_EXPECTATIONS,
								dataFingerprint
							}
						)
					}),
					/Auth schema fingerprint mismatch/
				)
				await expectCanonicalLedger()
			}
		}
	)

	integrationTest(
		'rolls back on Auth row drift',
		async () => {
			assert.ok(sql)
			const dataFingerprint = await currentDataFingerprint()
			await assert.rejects(
				sql.begin(async transaction => {
					await installProductionLedger(transaction)
					await transaction`
						INSERT INTO bauth."user" (id, email)
						VALUES ('baseline-adoption-drift', 'drift@example.test')
					`
					await adoptProductionAuthBaseline(
						transaction,
						baselineHash,
						baselineTimestamp,
						{
							...PRODUCTION_AUTH_BASELINE_EXPECTATIONS,
							dataFingerprint
						}
					)
				}),
				/Auth data fingerprint mismatch/
			)
			await expectCanonicalLedger()
		}
	)
})
