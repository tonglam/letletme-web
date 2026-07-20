import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

export const WEB_MIGRATIONS_SCHEMA = 'bauth'
export const WEB_MIGRATIONS_TABLE = '__drizzle_migrations'

export type LocalMigration = {
	tag: string
	when: number
	hash: string
}

export type LedgerMigration = {
	createdAt: number
	hash: string
}

export type MigrationAudit = {
	orphans: string[]
	extraLedgerEntries: LedgerMigration[]
	duplicateLedgerTimes: number[]
	checksumMismatches: LocalMigration[]
	pending: LocalMigration[]
	backdated: LocalMigration[]
	latestApplied: number | null
}

export async function loadLocalMigrations(
	migrationsFolder = 'drizzle',
): Promise<{ migrations: LocalMigration[]; orphans: string[] }> {
	const journal = JSON.parse(
		await readFile(join(migrationsFolder, 'meta', '_journal.json'), 'utf8'),
	) as { entries: Array<{ tag: string; when: number }> }
	const migrations: LocalMigration[] = []
	const tags = new Set<string>()
	const times = new Set<number>()
	let previousWhen = -1

	for (const entry of journal.entries) {
		if (
			!entry.tag ||
			!Number.isSafeInteger(entry.when) ||
			entry.when <= previousWhen ||
			tags.has(entry.tag) ||
			times.has(entry.when)
		) {
			throw new Error('Web migration journal must have unique, strictly increasing entries')
		}
		const contents = await readFile(join(migrationsFolder, `${entry.tag}.sql`), 'utf8')
		migrations.push({
			tag: entry.tag,
			when: entry.when,
			hash: createHash('sha256').update(contents).digest('hex'),
		})
		tags.add(entry.tag)
		times.add(entry.when)
		previousWhen = entry.when
	}

	const orphans = (await readdir(migrationsFolder))
		.filter(filename => filename.endsWith('.sql'))
		.filter(filename => !tags.has(filename.slice(0, -4)))
		.sort()

	return { migrations, orphans }
}

export function inspectMigrationHistory(
	migrations: readonly LocalMigration[],
	ledger: readonly LedgerMigration[],
	orphans: readonly string[] = [],
): MigrationAudit {
	const localByTime = new Map(migrations.map(migration => [migration.when, migration]))
	const ledgerByTime = new Map<number, LedgerMigration>()
	const duplicateLedgerTimes: number[] = []
	for (const row of ledger) {
		if (ledgerByTime.has(row.createdAt)) duplicateLedgerTimes.push(row.createdAt)
		else ledgerByTime.set(row.createdAt, row)
	}

	const extraLedgerEntries = ledger.filter(row => !localByTime.has(row.createdAt))
	const checksumMismatches = migrations.filter(migration => {
		const row = ledgerByTime.get(migration.when)
		return row !== undefined && row.hash !== migration.hash
	})
	const pending = migrations.filter(migration => !ledgerByTime.has(migration.when))
	const latestApplied = ledger.length
		? Math.max(...ledger.map(row => row.createdAt))
		: null
	const backdated = latestApplied
		? pending.filter(migration => migration.when < latestApplied)
		: []

	return {
		orphans: [...orphans],
		extraLedgerEntries,
		duplicateLedgerTimes: Array.from(new Set(duplicateLedgerTimes)).sort(
			(left, right) => left - right,
		),
		checksumMismatches,
		pending,
		backdated,
		latestApplied,
	}
}

export function assertMigrationHistory(audit: MigrationAudit, requireComplete: boolean): void {
	const problems = [
		audit.orphans.length ? `unjournaled SQL files: ${audit.orphans.join(', ')}` : '',
		audit.extraLedgerEntries.length
			? `ledger entries missing locally: ${audit.extraLedgerEntries.map(row => row.createdAt).join(', ')}`
			: '',
		audit.duplicateLedgerTimes.length
			? `duplicate ledger timestamps: ${audit.duplicateLedgerTimes.join(', ')}`
			: '',
		audit.checksumMismatches.length
			? `checksum mismatches: ${audit.checksumMismatches.map(row => row.tag).join(', ')}`
			: '',
		audit.backdated.length
			? `pending migrations before applied tail ${audit.latestApplied}: ${audit.backdated.map(row => row.tag).join(', ')}`
			: '',
		requireComplete && audit.pending.length
			? `pending migrations: ${audit.pending.map(row => row.tag).join(', ')}`
			: '',
	].filter(Boolean)

	if (problems.length) throw new Error(problems.join('; '))
}
