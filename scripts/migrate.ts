import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import postgres from 'postgres'

import {
	adoptProductionAuthBaseline,
	EXPECTED_AUTH_SCHEMA_FINGERPRINT
} from './auth-baseline-adoption'
import { loadAuthDataManifest } from './auth-data-contract'
import {
	fingerprintAuthContract,
	loadAuthSchemaContract
} from './auth-schema-contract'
import {
	assertMigrationHistory,
	inspectMigrationHistory,
	loadLocalMigrations,
	type LedgerMigration,
	type LocalMigration
} from './migration-audit'

const MIGRATIONS_FOLDER = 'drizzle'
const BASELINE_TAG = '0000_auth_baseline'
const ADVISORY_LOCK_NAME = 'letletme-web-auth-migrations'

type DatabaseState = {
	hasAuthSchema: boolean
	hasLedger: boolean
	hasRetiredSharedSchema: boolean
}

function requiredDatabaseUrl(): string {
	const value = process.env.DIRECT_DATABASE_URL?.trim()
	if (!value) throw new Error('DIRECT_DATABASE_URL is required for migrations')
	return value
}

async function assertPostgresVersion(client: postgres.Sql): Promise<void> {
	const [{ server_version_num: version }] = await client<
		{ server_version_num: string }[]
	>`
		SELECT current_setting('server_version_num') AS server_version_num
	`
	if (Number(version) < 150000) {
		throw new Error(
			`PostgreSQL 15 or newer is required (server_version_num=${version})`
		)
	}
}

async function inspectDatabaseState(
	client: postgres.Sql
): Promise<DatabaseState> {
	const [state] = await client<
		{
			has_auth_schema: boolean
			has_ledger: boolean
			has_retired_shared_schema: boolean
		}[]
	>`
		SELECT
			to_regnamespace('bauth') IS NOT NULL AS has_auth_schema,
			to_regclass('bauth.__drizzle_migrations') IS NOT NULL AS has_ledger,
			to_regnamespace('drizzle') IS NOT NULL AS has_retired_shared_schema
	`
	if (!state) throw new Error('Failed to inspect Web migration state')
	return {
		hasAuthSchema: state.has_auth_schema,
		hasLedger: state.has_ledger,
		hasRetiredSharedSchema: state.has_retired_shared_schema
	}
}

async function loadLedger(client: postgres.Sql): Promise<LedgerMigration[]> {
	const rows = await client<{ hash: string; created_at: string | null }[]>`
		SELECT hash, created_at::text
		FROM bauth.__drizzle_migrations
		ORDER BY created_at, id
	`
	return rows.map(row => {
		const createdAt = Number(row.created_at)
		if (row.created_at === null || !Number.isSafeInteger(createdAt)) {
			throw new Error('Web migration ledger contains an invalid timestamp')
		}
		return { hash: row.hash, createdAt }
	})
}

async function migrationContents(migration: LocalMigration): Promise<string> {
	return readFile(join(MIGRATIONS_FOLDER, `${migration.tag}.sql`), 'utf8')
}

async function assertFreshBaselineContract(
	transaction: postgres.TransactionSql
): Promise<void> {
	const schemaFingerprint = fingerprintAuthContract(
		await loadAuthSchemaContract(transaction)
	)
	if (schemaFingerprint !== EXPECTED_AUTH_SCHEMA_FINGERPRINT) {
		throw new Error(
			`Fresh Auth baseline schema fingerprint mismatch: expected=${EXPECTED_AUTH_SCHEMA_FINGERPRINT} actual=${schemaFingerprint}`
		)
	}

	const manifest = await loadAuthDataManifest(transaction)
	if (
		manifest.relations.length !== 8 ||
		manifest.relations.some(relation => relation.rowCount !== '0')
	) {
		throw new Error(
			'Fresh Auth baseline must contain eight empty business tables'
		)
	}
}

async function applyFreshBaseline(
	client: postgres.Sql,
	baseline: LocalMigration
): Promise<void> {
	const contents = await migrationContents(baseline)
	await client.begin(async transaction => {
		await transaction`SELECT set_config('lock_timeout', '5s', true)`
		await transaction`SELECT set_config('statement_timeout', '10min', true)`
		await transaction.unsafe(contents)
		await assertFreshBaselineContract(transaction)
		await transaction`
			INSERT INTO bauth.__drizzle_migrations (hash, created_at)
			VALUES (${baseline.hash}, ${baseline.when})
		`
	})
	console.log(`Applied ${baseline.tag}`)
}

async function adoptProductionBaseline(
	client: postgres.Sql,
	baseline: LocalMigration
): Promise<void> {
	await client.begin(async transaction => {
		await transaction`SELECT set_config('lock_timeout', '5s', true)`
		await transaction`SELECT set_config('statement_timeout', '15min', true)`
		await adoptProductionAuthBaseline(transaction, baseline.hash, baseline.when)
	})
	console.log(`Adopted ${baseline.tag}`)
}

async function applyPendingMigration(
	client: postgres.Sql,
	migration: LocalMigration
): Promise<void> {
	const contents = await migrationContents(migration)
	await client.begin(async transaction => {
		await transaction`SELECT set_config('lock_timeout', '5s', true)`
		await transaction`SELECT set_config('statement_timeout', '10min', true)`
		await transaction.unsafe(contents)
		await transaction`
			INSERT INTO bauth.__drizzle_migrations (hash, created_at)
			VALUES (${migration.hash}, ${migration.when})
		`
	})
	console.log(`Applied ${migration.tag}`)
}

async function main(): Promise<void> {
	const local = await loadLocalMigrations(MIGRATIONS_FOLDER)
	const baseline = local.migrations[0]
	if (!baseline || baseline.tag !== BASELINE_TAG) {
		throw new Error(`Web migration history must start with ${BASELINE_TAG}`)
	}
	if (local.orphans.length > 0) {
		throw new Error(`Unjournaled SQL files: ${local.orphans.join(', ')}`)
	}

	const client = postgres(requiredDatabaseUrl(), { max: 1, prepare: false })
	try {
		await assertPostgresVersion(client)
		await client`SELECT pg_advisory_lock(hashtext(${ADVISORY_LOCK_NAME}))`
		try {
			const state = await inspectDatabaseState(client)
			if (!state.hasLedger) {
				if (state.hasAuthSchema || state.hasRetiredSharedSchema) {
					throw new Error(
						'Refusing to install the Auth baseline over a partial or retired schema'
					)
				}
				await applyFreshBaseline(client, baseline)
			} else {
				const ledger = await loadLedger(client)
				const isCanonicalBaseline =
					ledger.length > 0 &&
					ledger[0]?.createdAt === baseline.when &&
					ledger[0]?.hash === baseline.hash
				if (!isCanonicalBaseline) {
					await adoptProductionBaseline(client, baseline)
					const adoptedState = await inspectDatabaseState(client)
					if (!adoptedState.hasLedger) {
						throw new Error(
							'Auth baseline adoption removed the migration ledger'
						)
					}
				}
			}

			const pendingAudit = inspectMigrationHistory(
				local.migrations,
				await loadLedger(client),
				local.orphans
			)
			assertMigrationHistory(pendingAudit, false)
			for (const migration of pendingAudit.pending) {
				await applyPendingMigration(client, migration)
			}

			const finalAudit = inspectMigrationHistory(
				local.migrations,
				await loadLedger(client),
				local.orphans
			)
			assertMigrationHistory(finalAudit, true)
		} finally {
			await client`
				SELECT pg_advisory_unlock(hashtext(${ADVISORY_LOCK_NAME}))
			`.catch(error => {
				console.error('Failed to release Web migration advisory lock', error)
			})
		}
		console.log('Web migrations applied successfully')
	} finally {
		await client.end()
	}
}

void main()
