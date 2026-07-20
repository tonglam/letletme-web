import postgres from 'postgres'

import {
	inspectMigrationHistory,
	loadLocalMigrations,
	WEB_MIGRATIONS_SCHEMA,
	WEB_MIGRATIONS_TABLE,
	type LedgerMigration,
} from './migration-audit'

async function main() {
	const databaseUrl = process.env.DIRECT_DATABASE_URL
	if (!databaseUrl) throw new Error('DIRECT_DATABASE_URL is required for migration status')
	const local = await loadLocalMigrations()
	const client = postgres(databaseUrl, { max: 1, prepare: false })
	try {
		const [{ server_version_num: version }] = await client<{ server_version_num: string }[]>`
			SELECT current_setting('server_version_num') AS server_version_num
		`
		if (Number(version) < 150000) {
			throw new Error(`PostgreSQL 15 or newer is required (server_version_num=${version})`)
		}
		const [{ ledger_exists: ledgerExists }] = await client<{ ledger_exists: boolean }[]>`
			SELECT to_regclass(${`${WEB_MIGRATIONS_SCHEMA}.${WEB_MIGRATIONS_TABLE}`}) IS NOT NULL AS ledger_exists
		`
		const rows = ledgerExists
			? await client<{ hash: string; created_at: string }[]>`
					SELECT hash, created_at::text
					FROM bauth.__drizzle_migrations
					ORDER BY created_at
				`
			: []
		const ledger: LedgerMigration[] = rows.map(row => ({
			hash: row.hash,
			createdAt: Number(row.created_at),
		}))
		const audit = inspectMigrationHistory(local.migrations, ledger, local.orphans)
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
		for (const row of audit.extraLedgerEntries) console.log(`missing ${row.createdAt}`)
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
