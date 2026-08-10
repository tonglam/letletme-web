import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	inspectMigrationHistory,
	loadLocalMigrations,
	type LocalMigration
} from '../../scripts/migration-audit'

const migrations: LocalMigration[] = [
	{ tag: '0000_first', when: 100, hash: 'first' },
	{ tag: '0001_second', when: 200, hash: 'second' },
	{ tag: '0002_third', when: 300, hash: 'third' },
]

describe('Web migration audit', () => {
	it('keeps the production-applied 0009 migration byte-for-byte frozen', async () => {
		const { migrations: localMigrations } = await loadLocalMigrations()
		const migration = localMigrations.find(
			row => row.tag === '0009_graphql_auth_reader'
		)
		assert.equal(
			migration?.hash,
			'91b8cf72e8583b945d0107e3a506b2dfb70d25784e306001c52ce03c8e2fabbb'
		)
	})

	it('allows pending migrations only after the applied tail', () => {
		const audit = inspectMigrationHistory(migrations, [{ createdAt: 100, hash: 'first' }])
		assert.deepEqual(audit.pending.map(row => row.tag), ['0001_second', '0002_third'])
		assert.deepEqual(audit.backdated, [])
	})

	it('detects backdated, edited, orphaned, and foreign ledger state', () => {
		const audit = inspectMigrationHistory(
			migrations,
			[
				{ createdAt: 200, hash: 'edited' },
				{ createdAt: 400, hash: 'missing-locally' },
			],
			['0009_orphan.sql'],
		)
		assert.deepEqual(audit.backdated.map(row => row.tag), ['0000_first', '0002_third'])
		assert.deepEqual(audit.checksumMismatches.map(row => row.tag), ['0001_second'])
		assert.deepEqual(audit.extraLedgerEntries.map(row => row.createdAt), [400])
		assert.deepEqual(audit.orphans, ['0009_orphan.sql'])
	})
})
