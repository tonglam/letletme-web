import { randomUUID } from 'node:crypto'

import {
	and,
	asc,
	eq,
	isNull,
	lte,
	or,
	sql
} from 'drizzle-orm'

import { db, schema } from '@/lib/db'
import { requestEntryInfoSync, type EntrySyncResult } from '@/lib/entry-sync'

export const ENTRY_SYNC_OUTBOX_LEASE_MS = 60_000
export const ENTRY_SYNC_OUTBOX_REQUEST_TIMEOUT_MS = 3_000
export const ENTRY_SYNC_OUTBOX_BATCH_SIZE = 10
export const ENTRY_SYNC_OUTBOX_CONCURRENCY = 2
export const ENTRY_SYNC_OUTBOX_RUN_BUDGET_MS = 20_000
export const ENTRY_SYNC_OUTBOX_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000

const OUTBOX_CLEANUP_BATCH_SIZE = 500
// Retention shares the hourly auth cleanup invocation. One 500-row batch
// leaves headroom below the 30-second platform limit even when the database
// statement reaches its three-second timeout; the returned residual count
// makes the next hourly pass observable rather than pretending to drain all.
const OUTBOX_CLEANUP_MAX_BATCHES = 1
// Auth-event cleanup and delivered-row retention share one 30s cron request;
// one bounded retention batch leaves room for both summaries and response
// serialization even when a database statement reaches its timeout.
const OUTBOX_CLEANUP_BUDGET_MS = 5_000
const OUTBOX_CLEANUP_LOCK_KEY = 'letletme-entry-sync-outbox-cleanup'

type EntrySyncOutboxTable = typeof schema.entrySyncOutbox
type EntrySyncOutboxTransaction = Parameters<
	Parameters<typeof db.transaction>[0]
>[0]

export type EntrySyncOutboxRecord = {
	entryId: number
	generation: number
	attempts: number
	leaseToken: string
}

export type EntrySyncOutboxDelivery =
	| { status: 'delivered'; jobId: string }
	| { status: 'pending' | 'leased' | 'stale'; reason?: string }

export type EntrySyncOutboxProcessResult = {
	claimed: number
	processed: number
	delivered: number
	retried: number
	failed: number
	stoppedByBudget: boolean
}

export type EntrySyncOutboxHealth = {
	pendingCount: number
	leasedCount: number
	deliveredCount: number
	oldestPendingAt: string | null
	oldestPendingAgeSeconds: number | null
	contractFailureCount: number
	oldestContractFailureAt: string | null
	generatedAt: string
}

export type EntrySyncOutboxCleanupResult = {
	deleted: number
	batches: number
	stoppedByLimit: boolean
	lockSkipped: boolean
	remainingDelivered: number
}

const assertEntryId = (entryId: number): void => {
	if (!Number.isSafeInteger(entryId) || entryId <= 0) {
		throw new TypeError('entryId must be a positive safe integer')
	}
}

const boundedError = (value: string): string => value.slice(0, 240)

const isContractFailureCode = (errorCode: string | undefined): boolean =>
	errorCode === 'INVALID_RESPONSE' ||
	(errorCode?.startsWith('HTTP_4') === true &&
		errorCode !== 'HTTP_408' &&
		errorCode !== 'HTTP_429')

const dueStatus = (table: EntrySyncOutboxTable, now: Date) =>
	and(
		lte(table.nextAttemptAt, now),
		or(
			eq(table.status, 'pending'),
			and(
				eq(table.status, 'leased'),
				or(isNull(table.leaseUntil), lte(table.leaseUntil, now))
			)
		)
	)

/** Record a new logical sync request in the caller's transaction. */
export async function recordEntrySyncRequest(
	tx: EntrySyncOutboxTransaction,
	entryId: number,
	now = new Date()
): Promise<number> {
	assertEntryId(entryId)
	const [row] = await tx
		.insert(schema.entrySyncOutbox)
		.values({
			entryId,
			generation: 1,
			status: 'pending',
			attempts: 0,
			nextAttemptAt: now,
			createdAt: now,
			updatedAt: now
		})
		.onConflictDoUpdate({
			target: schema.entrySyncOutbox.entryId,
			set: {
				generation: sql`${schema.entrySyncOutbox.generation} + 1`,
				status: 'pending',
				attempts: 0,
				nextAttemptAt: now,
				leaseToken: null,
				leaseUntil: null,
				dataJobId: null,
				lastErrorCode: null,
				lastError: null,
				createdAt: now,
				updatedAt: now
			}
		})
		.returning({ generation: schema.entrySyncOutbox.generation })
	if (!row) throw new Error('entry sync outbox request was not recorded')
	return row.generation
}

export async function enqueueEntrySyncRequest(
	entryId: number,
	now = new Date()
): Promise<number> {
	return db.transaction(async tx => {
		await tx.execute(sql`SELECT set_config('statement_timeout', '3s', true)`)
		await tx.execute(sql`SELECT set_config('lock_timeout', '1s', true)`)
		return recordEntrySyncRequest(tx, entryId, now)
	})
}

type ClaimedRow = EntrySyncOutboxRecord

async function claimRows(
	limit: number,
	now: Date,
	entryId?: number,
	generation?: number
): Promise<ClaimedRow[]> {
	const safeLimit = Math.max(1, Math.min(limit, ENTRY_SYNC_OUTBOX_BATCH_SIZE))
	return db.transaction(async tx => {
		await tx.execute(sql`SELECT set_config('statement_timeout', '3s', true)`)
		await tx.execute(sql`SELECT set_config('lock_timeout', '1s', true)`)
		const conditions = [dueStatus(schema.entrySyncOutbox, now)]
		if (entryId !== undefined) conditions.push(eq(schema.entrySyncOutbox.entryId, entryId))
		if (generation !== undefined)
			conditions.push(eq(schema.entrySyncOutbox.generation, generation))
		const candidates = await tx
			.select({
				entryId: schema.entrySyncOutbox.entryId,
				generation: schema.entrySyncOutbox.generation,
				attempts: schema.entrySyncOutbox.attempts
			})
			.from(schema.entrySyncOutbox)
			.where(and(...conditions))
			.orderBy(
				asc(schema.entrySyncOutbox.nextAttemptAt),
				asc(schema.entrySyncOutbox.entryId)
			)
			.limit(safeLimit)
			.for('update', { skipLocked: true })

		const claimed: ClaimedRow[] = []
		for (const candidate of candidates) {
			const leaseToken = randomUUID()
			const leaseUntil = new Date(now.getTime() + ENTRY_SYNC_OUTBOX_LEASE_MS)
			const [row] = await tx
				.update(schema.entrySyncOutbox)
				.set({
					status: 'leased',
					attempts: sql`${schema.entrySyncOutbox.attempts} + 1`,
					leaseToken,
					leaseUntil,
					updatedAt: now
				})
				.where(
					and(
						eq(schema.entrySyncOutbox.entryId, candidate.entryId),
						eq(schema.entrySyncOutbox.generation, candidate.generation)
					)
				)
				.returning({
					entryId: schema.entrySyncOutbox.entryId,
					generation: schema.entrySyncOutbox.generation,
					attempts: schema.entrySyncOutbox.attempts,
					leaseToken: schema.entrySyncOutbox.leaseToken
				})
			if (row?.leaseToken) {
				claimed.push({
					entryId: row.entryId,
					generation: row.generation,
					attempts: row.attempts,
					leaseToken: row.leaseToken
				})
			}
		}
		return claimed
	})
}

async function currentRow(entryId: number) {
	const [row] = await db.transaction(async tx => {
		await tx.execute(sql`SELECT set_config('statement_timeout', '3s', true)`)
		await tx.execute(sql`SELECT set_config('lock_timeout', '1s', true)`)
		return tx
			.select({
				generation: schema.entrySyncOutbox.generation,
				status: schema.entrySyncOutbox.status,
				dataJobId: schema.entrySyncOutbox.dataJobId
			})
			.from(schema.entrySyncOutbox)
			.where(eq(schema.entrySyncOutbox.entryId, entryId))
			.limit(1)
	})
	return row
}

const retryDelayMilliseconds = (
	result: Extract<EntrySyncResult, { ok: false }>,
	attempts: number
): number => {
	// Authentication, malformed queued responses, and non-transient 4xx
	// responses are configuration/contract failures. Keep retrying so an
	// operator fix can recover the hand-off, but do not spin on them like a
	// transient outage. 408 and 429 remain transient and use normal backoff.
	if (isContractFailureCode(result.errorCode))
		return 60 * 60 * 1_000
	if (!result.retryable) return 60 * 60 * 1_000
	const delays = [60_000, 300_000, 900_000, 3_600_000]
	const base = delays[Math.min(Math.max(attempts - 1, 0), delays.length - 1)]
	const retryAfter = (result.retryAfterSeconds ?? 0) * 1_000
	return Math.max(base, retryAfter)
}

async function settleClaim(
	row: ClaimedRow,
	result: EntrySyncResult,
	now: Date
): Promise<'delivered' | 'retried' | 'stale'> {
	if (result.ok) {
		const updated = await db.transaction(async tx => {
			await tx.execute(sql`SELECT set_config('statement_timeout', '3s', true)`)
			await tx.execute(sql`SELECT set_config('lock_timeout', '1s', true)`)
			return tx
				.update(schema.entrySyncOutbox)
				.set({
					status: 'delivered',
					dataJobId: result.jobId,
					nextAttemptAt: now,
					leaseToken: null,
					leaseUntil: null,
					lastErrorCode: null,
					lastError: null,
					updatedAt: now
				})
				.where(
					and(
						eq(schema.entrySyncOutbox.entryId, row.entryId),
						eq(schema.entrySyncOutbox.generation, row.generation),
						eq(schema.entrySyncOutbox.leaseToken, row.leaseToken)
					)
				)
				.returning({ entryId: schema.entrySyncOutbox.entryId })
		})
		return updated.length > 0 ? 'delivered' : 'stale'
	}
	if (isContractFailureCode(result.errorCode)) {
		console.error('[entry-sync-outbox] contract failure', {
			entryId: row.entryId,
			generation: row.generation,
			errorCode: result.errorCode ?? 'INVALID_RESPONSE'
		})
	}

	const nextAttemptAt = new Date(
		now.getTime() + retryDelayMilliseconds(result, row.attempts)
	)
	const updated = await db.transaction(async tx => {
		await tx.execute(sql`SELECT set_config('statement_timeout', '3s', true)`)
		await tx.execute(sql`SELECT set_config('lock_timeout', '1s', true)`)
		return tx
			.update(schema.entrySyncOutbox)
			.set({
				status: 'pending',
				nextAttemptAt,
				leaseToken: null,
				leaseUntil: null,
				lastErrorCode: result.errorCode ?? 'UPSTREAM_FAILURE',
				lastError: boundedError(result.reason),
				updatedAt: now
			})
			.where(
				and(
					eq(schema.entrySyncOutbox.entryId, row.entryId),
					eq(schema.entrySyncOutbox.generation, row.generation),
					eq(schema.entrySyncOutbox.leaseToken, row.leaseToken)
				)
			)
			.returning({ entryId: schema.entrySyncOutbox.entryId })
	})
	return updated.length > 0 ? 'retried' : 'stale'
}

async function deliverClaimedRow(
	row: ClaimedRow,
	now = new Date(),
	externalSignal?: AbortSignal
): Promise<EntrySyncOutboxDelivery> {
	const result = await requestEntryInfoSync(row.entryId, {
		timeoutMs: ENTRY_SYNC_OUTBOX_REQUEST_TIMEOUT_MS,
		signal: externalSignal
	})
	const settled = await settleClaim(row, result, now)
	if (settled === 'delivered') {
		if (!result.ok) return { status: 'stale', reason: 'delivery result changed' }
		return { status: 'delivered', jobId: result.jobId }
	}
	if (settled === 'stale') return { status: 'stale', reason: 'generation or lease changed' }
	return { status: 'pending', reason: result.ok ? undefined : result.reason }
}

/** Attempt one immediate delivery after an outbox row has been committed. */
export async function deliverEntrySyncOutboxNow(
	entryId: number,
	generation?: number,
	now = new Date(),
	externalSignal?: AbortSignal
): Promise<EntrySyncOutboxDelivery> {
	assertEntryId(entryId)
	const claimed = await claimRows(1, now, entryId, generation)
	if (claimed[0]) return deliverClaimedRow(claimed[0], now, externalSignal)

	const current = await currentRow(entryId)
	if (!current || (generation !== undefined && current.generation !== generation)) {
		return { status: 'stale', reason: 'outbox generation is no longer current' }
	}
	if (current.status === 'delivered' && current.dataJobId) {
		return { status: 'delivered', jobId: current.dataJobId }
	}
	return { status: current.status === 'leased' ? 'leased' : 'pending' }
}

export async function processEntrySyncOutbox(
	now = new Date()
): Promise<EntrySyncOutboxProcessResult> {
	const startedAt = Date.now()
	const deadline = startedAt + ENTRY_SYNC_OUTBOX_RUN_BUDGET_MS
	const runController = new AbortController()
	const budgetTimer = setTimeout(() => runController.abort(), ENTRY_SYNC_OUTBOX_RUN_BUDGET_MS)
	let claimedCount = 0
	let processed = 0
	let delivered = 0
	let retried = 0
	let failed = 0
	let stoppedByBudget = false

	try {
		while (claimedCount < ENTRY_SYNC_OUTBOX_BATCH_SIZE) {
			if (Date.now() + ENTRY_SYNC_OUTBOX_REQUEST_TIMEOUT_MS > deadline) {
				stoppedByBudget = true
				break
			}
			const rows = await claimRows(
				ENTRY_SYNC_OUTBOX_BATCH_SIZE - claimedCount,
				new Date()
			)
			if (rows.length === 0) break
			claimedCount += rows.length

			for (let offset = 0; offset < rows.length; offset += ENTRY_SYNC_OUTBOX_CONCURRENCY) {
				if (Date.now() >= deadline || runController.signal.aborted) {
					stoppedByBudget = true
					break
				}
				const group = rows.slice(offset, offset + ENTRY_SYNC_OUTBOX_CONCURRENCY)
				const outcomes = await Promise.allSettled(
					group.map(row => deliverClaimedRow(row, new Date(), runController.signal))
				)
				for (const outcome of outcomes) {
					processed += 1
					if (outcome.status === 'rejected') {
						failed += 1
						continue
					}
					switch (outcome.value.status) {
						case 'delivered':
							delivered += 1
							break
						case 'pending':
							retried += 1
							break
						default:
							failed += 1
					}
				}
			}
			if (Date.now() >= deadline || runController.signal.aborted) stoppedByBudget = true
			if (stoppedByBudget) break
		}
	} finally {
		clearTimeout(budgetTimer)
	}

	return {
		claimed: claimedCount,
		processed,
		delivered,
		retried,
		failed,
		stoppedByBudget
	}
}

export async function getEntrySyncOutboxHealth(
	now = new Date()
): Promise<EntrySyncOutboxHealth> {
	const [row] = await db.transaction(async tx => {
		await tx.execute(sql`SELECT set_config('statement_timeout', '3s', true)`)
		await tx.execute(sql`SELECT set_config('lock_timeout', '1s', true)`)
		return tx.execute<{
			pending_count: number
			leased_count: number
			delivered_count: number
			oldest_pending_at: string | null
			contract_failure_count: number
			oldest_contract_failure_at: string | null
		}>(sql`
			SELECT
				count(*) FILTER (WHERE status = 'pending')::integer AS pending_count,
				count(*) FILTER (WHERE status = 'leased')::integer AS leased_count,
				count(*) FILTER (WHERE status = 'delivered')::integer AS delivered_count,
				(min(created_at) FILTER (WHERE status = 'pending'))::text AS oldest_pending_at,
				count(*) FILTER (
					WHERE status = 'pending'
						AND (
							last_error_code = 'INVALID_RESPONSE'
						OR (
							last_error_code LIKE 'HTTP_4%'
							AND last_error_code NOT IN ('HTTP_408', 'HTTP_429')
						)
						)
				)::integer AS contract_failure_count,
				(min(updated_at) FILTER (
					WHERE status = 'pending'
						AND (
							last_error_code = 'INVALID_RESPONSE'
						OR (
							last_error_code LIKE 'HTTP_4%'
							AND last_error_code NOT IN ('HTTP_408', 'HTTP_429')
						)
						)
				))::text AS oldest_contract_failure_at
			FROM bauth.entry_sync_outbox
		`)
	})
	const oldestPendingAt = row?.oldest_pending_at ?? null
	const oldestTimestamp = oldestPendingAt ? Date.parse(oldestPendingAt) : NaN
	return {
		pendingCount: Number(row?.pending_count ?? 0),
		leasedCount: Number(row?.leased_count ?? 0),
		deliveredCount: Number(row?.delivered_count ?? 0),
		oldestPendingAt,
		oldestPendingAgeSeconds: Number.isFinite(oldestTimestamp)
			? Math.max(0, Math.floor((now.getTime() - oldestTimestamp) / 1_000))
			: null,
		contractFailureCount: Number(row?.contract_failure_count ?? 0),
		oldestContractFailureAt: row?.oldest_contract_failure_at ?? null,
		generatedAt: now.toISOString()
	}
}

async function purgeDeliveredEntrySyncOutboxBatch(
	now: Date
): Promise<{ deleted: number; lockSkipped: boolean }> {
	const result = await db.transaction(async tx => {
		const [lock] = await tx.execute<{ locked: boolean }>(sql`
			SELECT pg_try_advisory_xact_lock(hashtextextended(${OUTBOX_CLEANUP_LOCK_KEY}, 0)) AS locked
		`)
		if (!lock?.locked) return { deleted: 0, lockSkipped: true }
		await tx.execute(sql`SELECT set_config('statement_timeout', '3s', true)`)
		await tx.execute(sql`SELECT set_config('lock_timeout', '1s', true)`)
		const deleted = await tx.execute(sql`
			DELETE FROM bauth.entry_sync_outbox
			WHERE entry_id IN (
				SELECT entry_id
				FROM bauth.entry_sync_outbox
				WHERE status = 'delivered'
					AND updated_at <= ${new Date(now.getTime() - ENTRY_SYNC_OUTBOX_RETENTION_MS)}
				ORDER BY updated_at, entry_id
				LIMIT ${OUTBOX_CLEANUP_BATCH_SIZE}
			)
			RETURNING entry_id
		`)
		return { deleted: deleted.length, lockSkipped: false }
	})
	return result
}

export async function purgeDeliveredEntrySyncOutbox(
	now = new Date()
): Promise<EntrySyncOutboxCleanupResult> {
	const startedAt = Date.now()
	let deleted = 0
	let batches = 0
	let lockSkipped = false
	let stoppedByLimit = false
	let lastBatchFilled = false
	while (batches < OUTBOX_CLEANUP_MAX_BATCHES) {
		if (Date.now() - startedAt >= OUTBOX_CLEANUP_BUDGET_MS) {
			stoppedByLimit = true
			break
		}
		const batch = await purgeDeliveredEntrySyncOutboxBatch(now)
		batches += 1
		if (batch.lockSkipped) {
			lockSkipped = true
			break
		}
		deleted += batch.deleted
		lastBatchFilled = batch.deleted >= OUTBOX_CLEANUP_BATCH_SIZE
		if (batch.deleted < OUTBOX_CLEANUP_BATCH_SIZE) break
	}
	if (batches >= OUTBOX_CLEANUP_MAX_BATCHES && lastBatchFilled) stoppedByLimit = true
	const [remaining] = await db.transaction(async tx => {
		await tx.execute(sql`SELECT set_config('statement_timeout', '3s', true)`)
		await tx.execute(sql`SELECT set_config('lock_timeout', '1s', true)`)
		return tx.execute<{ remaining_delivered: number }>(sql`
			SELECT count(*)::integer AS remaining_delivered
			FROM bauth.entry_sync_outbox
			WHERE status = 'delivered'
				AND updated_at <= ${new Date(now.getTime() - ENTRY_SYNC_OUTBOX_RETENTION_MS)}
		`)
	})
	return {
		deleted,
		batches,
		stoppedByLimit,
		lockSkipped,
		remainingDelivered: Number(remaining?.remaining_delivered ?? 0)
	}
}
