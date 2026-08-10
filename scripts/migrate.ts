import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import postgres from 'postgres'

import {
	assertMigrationHistory,
	inspectMigrationHistory,
	loadLocalMigrations,
	WEB_MIGRATIONS_SCHEMA,
	WEB_MIGRATIONS_TABLE,
	type LedgerMigration,
} from './migration-audit'

const MIGRATIONS_FOLDER = 'drizzle'
const ACTIVATION_MIGRATION = '0008_web_auth_runtime_role'

type MigrationJournal = {
	version: string
	dialect: string
	entries: Array<{
		idx: number
		version: string
		when: number
		tag: string
		breakpoints: boolean
	}>
}

function migrationConfig(migrationsFolder = MIGRATIONS_FOLDER) {
	return {
		migrationsFolder,
		migrationsSchema: WEB_MIGRATIONS_SCHEMA,
		migrationsTable: WEB_MIGRATIONS_TABLE,
	}
}

async function createScopedMigrationsFolder(throughTag: string): Promise<string> {
	const journalPath = join(MIGRATIONS_FOLDER, 'meta', '_journal.json')
	const journal = JSON.parse(await readFile(journalPath, 'utf8')) as MigrationJournal
	const targetIndex = journal.entries.findIndex(entry => entry.tag === throughTag)
	if (targetIndex < 0) throw new Error(`Unknown WEB_MIGRATION_THROUGH target: ${throughTag}`)

	const folder = await mkdtemp(join(tmpdir(), 'letletme-web-migrations-'))
	try {
		const entries = journal.entries.slice(0, targetIndex + 1)
		await mkdir(join(folder, 'meta'))
		await writeFile(
			join(folder, 'meta', '_journal.json'),
			`${JSON.stringify({ ...journal, entries }, null, '\t')}\n`,
		)
		await Promise.all(
			entries.map(entry =>
				copyFile(
					join(MIGRATIONS_FOLDER, `${entry.tag}.sql`),
					join(folder, `${entry.tag}.sql`),
				),
			),
		)
		return folder
	} catch (error) {
		await rm(folder, { recursive: true, force: true })
		throw error
	}
}

async function main() {
	const databaseUrl = process.env.DIRECT_DATABASE_URL
	if (!databaseUrl) throw new Error('DIRECT_DATABASE_URL is required for migrations')
	const throughTag = process.env.WEB_MIGRATION_THROUGH?.trim()
	if (throughTag && throughTag !== ACTIVATION_MIGRATION) {
		throw new Error(`WEB_MIGRATION_THROUGH may only target ${ACTIVATION_MIGRATION}`)
	}
	const scopedFolder = throughTag ? await createScopedMigrationsFolder(throughTag) : null
	const client = postgres(databaseUrl, { max: 1, prepare: false })
	const database = drizzle(client)
	try {
		const [{ server_version_num: version }] = await client<{ server_version_num: string }[]>`
			SELECT current_setting('server_version_num') AS server_version_num
		`
		if (Number(version) < 150000) {
			throw new Error(`PostgreSQL 15 or newer is required (server_version_num=${version})`)
		}
		await client`CREATE SCHEMA IF NOT EXISTS bauth`
		await client`SELECT pg_advisory_lock(hashtext('letletme-web-drizzle-migrations'))`
		try {
			await client`
				CREATE TABLE IF NOT EXISTS bauth.__drizzle_migrations (
					id serial PRIMARY KEY,
					hash text NOT NULL,
					created_at bigint
				)
			`
			await client`ALTER TABLE bauth.__drizzle_migrations ENABLE ROW LEVEL SECURITY`
			await client`REVOKE ALL ON TABLE bauth.__drizzle_migrations FROM PUBLIC`
			for (const role of ['anon', 'authenticated']) {
				const [{ exists }] = await client<{ exists: boolean }[]>`
					SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${role}) AS exists
				`
				if (exists) await client.unsafe(`REVOKE ALL ON TABLE bauth.__drizzle_migrations FROM ${role}`)
			}

			const local = await loadLocalMigrations()
			const dedicatedRows = await client<{ hash: string; created_at: string }[]>`
				SELECT hash, created_at::text FROM bauth.__drizzle_migrations ORDER BY created_at
			`
			const dedicatedTimes = new Set(dedicatedRows.map(row => Number(row.created_at)))
			const [{ shared_exists: sharedExists }] = await client<{ shared_exists: boolean }[]>`
				SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS shared_exists
			`
			if (sharedExists) {
				const sharedRows = await client<{ hash: string; created_at: string }[]>`
					SELECT hash, created_at::text FROM drizzle.__drizzle_migrations ORDER BY created_at
				`
				for (const migration of local.migrations) {
					if (dedicatedTimes.has(migration.when)) continue
					const matches = sharedRows.filter(row => Number(row.created_at) === migration.when)
					if (matches.length > 1) {
						throw new Error(`Shared migration ledger has duplicate timestamp ${migration.when}`)
					}
					const legacy = matches[0]
					if (!legacy) continue
					if (legacy.hash !== migration.hash) {
						throw new Error(`Shared migration checksum mismatch for ${migration.tag}`)
					}
					await client`
						INSERT INTO bauth.__drizzle_migrations (hash, created_at)
						VALUES (${legacy.hash}, ${migration.when})
					`
					dedicatedTimes.add(migration.when)
					console.log(`Adopted legacy Web migration ${migration.tag}`)
				}
			}

			const beforeRows = await client<{ hash: string; created_at: string }[]>`
				SELECT hash, created_at::text FROM bauth.__drizzle_migrations ORDER BY created_at
			`
			const toLedger = (rows: typeof beforeRows): LedgerMigration[] =>
				rows.map(row => ({ hash: row.hash, createdAt: Number(row.created_at) }))
			assertMigrationHistory(
				inspectMigrationHistory(local.migrations, toLedger(beforeRows), local.orphans),
				false,
			)

			await migrate(database, migrationConfig(scopedFolder ?? MIGRATIONS_FOLDER))

			const afterRows = await client<{ hash: string; created_at: string }[]>`
				SELECT hash, created_at::text FROM bauth.__drizzle_migrations ORDER BY created_at
			`
			const afterAudit = inspectMigrationHistory(
				local.migrations,
				toLedger(afterRows),
				local.orphans,
			)
			assertMigrationHistory(afterAudit, !throughTag)
			if (throughTag) {
				const target = local.migrations.find(migration => migration.tag === throughTag)
				if (!target) throw new Error(`Missing scoped migration target: ${throughTag}`)
				const incomplete = afterAudit.pending.filter(migration => migration.when <= target.when)
				if (incomplete.length > 0) {
					throw new Error(
						`Scoped migration did not apply through ${throughTag}: ${incomplete.map(row => row.tag).join(', ')}`,
					)
				}
			}
		} finally {
			await client`SELECT pg_advisory_unlock(hashtext('letletme-web-drizzle-migrations'))`
		}
		console.log('Web migrations applied successfully')
	} finally {
		await client.end()
		if (scopedFolder) await rm(scopedFolder, { recursive: true, force: true })
	}
}

void main()
