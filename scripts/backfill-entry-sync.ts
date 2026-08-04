/**
 * One-time backfill: ask letletme_data to sync every currently-bound FPL
 * entry into entry_infos (and the EntryInfo:{season} Redis hash), so the
 * daily cron and GraphQL entry(id) cover entries that were bound before the
 * bind-time sync hook existed.
 *
 * Idempotent (upsert + diff-based HSET) — safe to re-run.
 *
 * Run: npx tsx --env-file=.env scripts/backfill-entry-sync.ts
 *
 * Zero-code alternative:
 *   for id in $(psql "$DATABASE_URL" -tA -c \
 *     'select fpl_entry_id from bauth."user" where fpl_entry_verified_at is not null'); do
 *     curl -s -X POST "$LETLETME_DATA_URL/entry-info/$id/sync" -H "x-api-key: $KEY"; sleep 1
 *   done
 */
import postgres from 'postgres'

import {
	countEntrySyncResults,
	requestEntryInfoSync,
	type EntrySyncResult,
} from '../lib/entry-sync'

const POLITENESS_DELAY_MS = 300 // avoid burst-queuing a large bound-entry set

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
	console.error('DATABASE_URL is not set')
	process.exit(1)
}

async function main() {
	const sql = postgres(databaseUrl as string, { prepare: false })

	const rows = await sql<{ fpl_entry_id: number }[]>`
		select fpl_entry_id from bauth."user"
		where fpl_entry_verified_at is not null and fpl_entry_id is not null
		order by fpl_entry_id
	`

	console.log(`Backfilling ${rows.length} bound entries…`)

	const results: EntrySyncResult[] = []
	for (const row of rows) {
		const result = await requestEntryInfoSync(row.fpl_entry_id)
		results.push(result)
		if (result.ok && result.status === 'queued') {
			console.log(
				`  ↻ ${row.fpl_entry_id} queued as job ${result.jobId}`,
			)
		} else if (result.ok) {
			console.log(`  ✓ ${row.fpl_entry_id} completed`)
		} else {
			console.warn(`  ✗ ${row.fpl_entry_id}: ${result.reason}`)
		}
		await new Promise(resolve => setTimeout(resolve, POLITENESS_DELAY_MS))
	}

	await sql.end()
	const counts = countEntrySyncResults(results)
	console.log(
		`Done: ${counts.completed} completed, ${counts.queued} queued, ${counts.failed} failed`,
	)
	process.exit(counts.failed > 0 ? 1 : 0)
}

void main()
