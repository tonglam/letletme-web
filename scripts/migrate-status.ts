import postgres from 'postgres'

import {
	inspectMigrationHistory,
	loadLocalMigrations,
	type LedgerMigration
} from './migration-audit'

const BASELINE_TAG = '0000_auth_baseline'

function requiredDatabaseUrl(): string {
	const value = process.env.DIRECT_DATABASE_URL?.trim()
	if (!value) {
		throw new Error('DIRECT_DATABASE_URL is required for migration status')
	}
	return value
}

async function main(): Promise<void> {
	const local = await loadLocalMigrations()
	const baseline = local.migrations[0]
	if (!baseline || baseline.tag !== BASELINE_TAG) {
		throw new Error(`Web migration history must start with ${BASELINE_TAG}`)
	}

	const client = postgres(requiredDatabaseUrl(), { max: 1, prepare: false })
	try {
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

		const [{ ledger_exists: ledgerExists }] = await client<
			{ ledger_exists: boolean }[]
		>`
			SELECT to_regclass('bauth.__drizzle_migrations') IS NOT NULL AS ledger_exists
		`
		if (!ledgerExists) {
			console.log(`pending ${BASELINE_TAG}`)
			process.exitCode = 1
			return
		}

		const rows = await client<{ hash: string; created_at: string | null }[]>`
			SELECT hash, created_at::text
			FROM bauth.__drizzle_migrations
			ORDER BY created_at, id
		`
		const ledger: LedgerMigration[] = rows.map(row => {
			const createdAt = Number(row.created_at)
			if (row.created_at === null || !Number.isSafeInteger(createdAt)) {
				throw new Error('Web migration ledger contains an invalid timestamp')
			}
			return { hash: row.hash, createdAt }
		})

		if (
			ledger[0]?.createdAt !== baseline.when ||
			ledger[0]?.hash !== baseline.hash
		) {
			console.log(
				`invalid migration ledger (expected ${BASELINE_TAG})`
			)
			process.exitCode = 1
			return
		}

		const audit = inspectMigrationHistory(
			local.migrations,
			ledger,
			local.orphans
		)
		const applied = new Map(ledger.map(row => [row.createdAt, row]))
		const backdated = new Set(audit.backdated.map(row => row.when))
		for (const migration of local.migrations) {
			const row = applied.get(migration.when)
			const state = !row
				? backdated.has(migration.when)
					? 'backdated'
					: 'pending'
				: row.hash === migration.hash
					? 'applied'
					: 'mismatch'
			console.log(`${state} ${migration.tag}`)
		}
		for (const orphan of audit.orphans) console.log(`orphan ${orphan}`)
		for (const row of audit.extraLedgerEntries) {
			console.log(`missing ${row.createdAt}`)
		}
		if (
			audit.pending.length ||
			audit.orphans.length ||
			audit.extraLedgerEntries.length ||
			audit.duplicateLedgerTimes.length ||
			audit.checksumMismatches.length
		) {
			process.exitCode = 1
		}
	} finally {
		await client.end()
	}
}

void main()
