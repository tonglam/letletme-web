import 'server-only'

import { randomBytes, randomUUID } from 'crypto'
import { and, count, desc, eq, gte, isNull, lt, or, sql } from 'drizzle-orm'
import { after } from 'next/server'

import { db, schema } from '@/lib/db'
import { syncEntryAfterBind } from '@/lib/entry-sync'
import {
	FPL_BINDING_CHALLENGE_TTL_MS,
	FPL_BINDING_CREATION_LIMIT,
	FPL_BINDING_MAX_ATTEMPTS,
	FPL_BINDING_RATE_LIMIT_MAX,
	FPL_BINDING_RATE_LIMIT_WINDOW_SECONDS,
	FPL_IDENTITY_REFRESH_INTERVAL_MS,
	assertFplEntryId,
	fplTeamNamesMatch
} from '@/lib/fpl-binding-core'
import { validateFplEntry } from '@/lib/fpl'

export class FplBindingError extends Error {
	status: number

	constructor(message: string, status = 400) {
		super(message)
		this.name = 'FplBindingError'
		this.status = status
	}
}

export type FplBindingChallenge = {
	id: string
	entryId: number
	requiredName: string
	expiresAt: string
	teamName: string
	managerName: string
}

function requiredTeamName(): string {
	return `LLM-${randomBytes(3).toString('hex').toUpperCase()}`
}

function isUniqueViolation(error: unknown): boolean {
	return Boolean(
		error &&
		typeof error === 'object' &&
		'code' in error &&
		(error as { code?: unknown }).code === '23505'
	)
}

export async function startFplEntryBindingChallenge(
	userId: string,
	entryIdInput: unknown
): Promise<FplBindingChallenge> {
	const entryId = assertFplEntryId(entryIdInput)
	const entry = await validateFplEntry(entryId)
	if (!entry.valid || !entry.teamName || !entry.managerName) {
		throw new FplBindingError(
			`No FPL team found with ID ${entryId}. Check your FPL entry number.`
		)
	}

	const now = new Date()
	const challenge = {
		id: randomUUID(),
		userId,
		entryId,
		requiredName: requiredTeamName(),
		expiresAt: new Date(now.getTime() + FPL_BINDING_CHALLENGE_TTL_MS)
	}

	await db.transaction(async tx => {
		const lockedUsers = await tx.execute<{ id: string }>(
			sql`select id from bauth."user" where id = ${userId} for update`
		)
		if (!lockedUsers[0]) throw new FplBindingError('Not authenticated', 401)

		const [recent] = await tx
			.select({ value: count() })
			.from(schema.fplEntryBindingChallenge)
			.where(
				and(
					eq(schema.fplEntryBindingChallenge.userId, userId),
					gte(
						schema.fplEntryBindingChallenge.createdAt,
						new Date(now.getTime() - 60 * 60 * 1000)
					)
				)
			)
		if ((recent?.value ?? 0) >= FPL_BINDING_CREATION_LIMIT) {
			throw new FplBindingError(
				'Too many binding challenges; try again later',
				429
			)
		}

		await tx
			.update(schema.fplEntryBindingChallenge)
			.set({ consumedAt: now, updatedAt: now })
			.where(
				and(
					eq(schema.fplEntryBindingChallenge.userId, userId),
					isNull(schema.fplEntryBindingChallenge.consumedAt)
				)
			)

		await tx.insert(schema.fplEntryBindingChallenge).values(challenge)
	})

	return {
		id: challenge.id,
		entryId,
		requiredName: challenge.requiredName,
		expiresAt: challenge.expiresAt.toISOString(),
		teamName: entry.teamName,
		managerName: entry.managerName
	}
}

export async function confirmFplEntryBindingChallenge(
	userId: string,
	challengeId: unknown
): Promise<{
	entryId: number
	teamName: string
	managerName: string
	verifiedAt: string
}> {
	if (typeof challengeId !== 'string' || !challengeId) {
		throw new FplBindingError('Binding challenge is required')
	}

	const [pending] = await db
		.select()
		.from(schema.fplEntryBindingChallenge)
		.where(
			and(
				eq(schema.fplEntryBindingChallenge.id, challengeId),
				eq(schema.fplEntryBindingChallenge.userId, userId),
				isNull(schema.fplEntryBindingChallenge.consumedAt)
			)
		)
		.orderBy(desc(schema.fplEntryBindingChallenge.createdAt))
		.limit(1)

	const now = new Date()
	if (
		!pending ||
		pending.expiresAt.getTime() <= now.getTime() ||
		pending.attempts >= FPL_BINDING_MAX_ATTEMPTS
	) {
		throw new FplBindingError('Binding challenge is invalid or expired')
	}

	const entry = await validateFplEntry(pending.entryId)
	if (!entry.valid || !entry.teamName || !entry.managerName) {
		throw new FplBindingError('Unable to verify the FPL team right now', 503)
	}

	if (!fplTeamNamesMatch(entry.teamName, pending.requiredName)) {
		await db.transaction(async tx => {
			const attemptNow = new Date()
			await tx.execute(
				sql`select id from bauth."user" where id = ${userId} for update`
			)
			const locked = await tx.execute<{ attempts: number }>(sql`
				select attempts
				from bauth.fpl_entry_binding_challenges
				where id = ${challengeId} and user_id = ${userId} and consumed_at is null
				for update
			`)
			if (!locked[0]) return
			const nextAttempts = locked[0].attempts + 1
			await tx
				.update(schema.fplEntryBindingChallenge)
				.set({
					attempts: nextAttempts,
					consumedAt:
						nextAttempts >= FPL_BINDING_MAX_ATTEMPTS ? attemptNow : null,
					updatedAt: attemptNow
				})
				.where(eq(schema.fplEntryBindingChallenge.id, challengeId))
		})
		throw new FplBindingError(
			`Team name does not yet match ${pending.requiredName}. Change it in FPL and try again.`
		)
	}

	try {
		await db.transaction(async tx => {
			const confirmedAt = new Date()
			const lockedUsers = await tx.execute<{ id: string }>(
				sql`select id from bauth."user" where id = ${userId} for update`
			)
			if (!lockedUsers[0]) throw new FplBindingError('Not authenticated', 401)
			const lockedChallenges = await tx.execute<{
				entry_id: number
				expires_at: Date
				attempts: number
			}>(sql`
				select entry_id, expires_at, attempts
				from bauth.fpl_entry_binding_challenges
				where id = ${challengeId} and user_id = ${userId} and consumed_at is null
				for update
			`)
			const locked = lockedChallenges[0]
			if (
				!locked ||
				new Date(locked.expires_at).getTime() <= confirmedAt.getTime() ||
				locked.attempts >= FPL_BINDING_MAX_ATTEMPTS ||
				locked.entry_id !== pending.entryId
			) {
				throw new FplBindingError('Binding challenge is invalid or expired')
			}

			await tx
				.update(schema.user)
				.set({
					fplEntryId: pending.entryId,
					fplEntryBoundAt: confirmedAt,
					fplEntryVerifiedAt: confirmedAt,
					updatedAt: confirmedAt
				})
				.where(eq(schema.user.id, userId))
			await tx
				.update(schema.fplEntryBindingChallenge)
				.set({ consumedAt: confirmedAt, updatedAt: confirmedAt })
				.where(eq(schema.fplEntryBindingChallenge.id, challengeId))
		})
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new FplBindingError(
				'This FPL entry is already verified by another account',
				409
			)
		}
		throw error
	}

	return {
		entryId: pending.entryId,
		teamName: entry.teamName,
		managerName: entry.managerName,
		verifiedAt: now.toISOString()
	}
}

const BINDING_RATE_LIMIT_SCOPE = 'fpl-entry-binding'

/**
 * Durable per-user fixed-window limit on binding attempts, backed by the
 * request_rate_limits table so it holds across serverless instances. The
 * upsert increments atomically, so concurrent attempts count exactly. Every
 * invocation consumes quota — including invalid IDs — because the point is
 * to cap upstream FPL and data-service traffic per account. Stale buckets
 * are tiny and expire-indexed; no janitor for now.
 */
async function assertBindingRateLimit(userId: string): Promise<void> {
	const windowMs = FPL_BINDING_RATE_LIMIT_WINDOW_SECONDS * 1000
	const now = Date.now()
	const bucketStart = new Date(Math.floor(now / windowMs) * windowMs)
	const expiresAt = new Date(bucketStart.getTime() + 2 * windowMs)

	const [bucket] = await db
		.insert(schema.requestRateLimit)
		.values({
			scope: BINDING_RATE_LIMIT_SCOPE,
			subject: userId,
			bucketStart,
			windowSeconds: FPL_BINDING_RATE_LIMIT_WINDOW_SECONDS,
			count: 1,
			expiresAt
		})
		.onConflictDoUpdate({
			target: [
				schema.requestRateLimit.scope,
				schema.requestRateLimit.subject,
				schema.requestRateLimit.bucketStart
			],
			set: { count: sql`${schema.requestRateLimit.count} + 1` }
		})
		.returning({ count: schema.requestRateLimit.count })

	if ((bucket?.count ?? 0) > FPL_BINDING_RATE_LIMIT_MAX) {
		throw new FplBindingError('Too many binding attempts; try again later', 429)
	}
}

/**
 * Product decision: an FPL entry ID is not a strong asset, so binding does
 * not require proving ownership — pasting the ID (or a URL containing it)
 * is enough. The unique constraint on user.fpl_entry_id still prevents two
 * accounts from holding the same entry. The rename-challenge machinery
 * above is retained but no longer used by the binding actions.
 */
export async function bindFplEntryDirectly(
	userId: string,
	entryIdInput: unknown
): Promise<{
	entryId: number
	teamName: string
	managerName: string
	verifiedAt: string
}> {
	await assertBindingRateLimit(userId)
	const entryId = assertFplEntryId(entryIdInput)
	const entry = await validateFplEntry(entryId)
	if (!entry.valid || !entry.teamName || !entry.managerName) {
		throw new FplBindingError(
			`No FPL team found with ID ${entryId}. Check your FPL entry number.`
		)
	}
	const teamName = entry.teamName
	const managerName = entry.managerName

	const boundAt = new Date()
	try {
		const [updated] = await db.transaction(async tx => {
			const [current] = await tx
				.select({
					fplEntryId: schema.user.fplEntryId,
					fplTeamName: schema.user.fplTeamName,
					fplManagerName: schema.user.fplManagerName,
					fplIdentityRefreshedAt: schema.user.fplIdentityRefreshedAt
				})
				.from(schema.user)
				.where(eq(schema.user.id, userId))
				.limit(1)

			if (current?.fplEntryId && current.fplTeamName?.trim()) {
				await tx
					.insert(schema.fplEntryNameHistory)
					.values({
						id: randomUUID(),
						userId,
						entryId: current.fplEntryId,
						teamName: current.fplTeamName.trim(),
						managerName: current.fplManagerName?.trim() || null,
						firstSeenAt: current.fplIdentityRefreshedAt ?? boundAt,
						lastSeenAt: current.fplIdentityRefreshedAt ?? boundAt
					})
					.onConflictDoNothing()
			}

			await tx
				.insert(schema.fplEntryNameHistory)
				.values({
					id: randomUUID(),
					userId,
					entryId,
					teamName: teamName.trim(),
					managerName: managerName.trim(),
					firstSeenAt: boundAt,
					lastSeenAt: boundAt
				})
				.onConflictDoNothing()

			return tx
				.update(schema.user)
				.set({
					fplEntryId: entryId,
					fplEntryBoundAt: boundAt,
					fplEntryVerifiedAt: boundAt,
					fplTeamName: teamName,
					fplManagerName: managerName,
					fplIdentityRefreshedAt: boundAt,
					updatedAt: boundAt
				})
				.where(eq(schema.user.id, userId))
				.returning({ id: schema.user.id })
		})

		if (!updated) throw new FplBindingError('Not authenticated', 401)
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new FplBindingError(
				'This FPL entry is already verified by another account',
				409
			)
		}
		throw error
	}

	// Post-response: land the entry in letletme_data's entry_infos so the daily
	// cron and GraphQL entry(id) pick it up. Failure-isolated — syncEntryAfterBind
	// never throws, and after() runs it after the action's response is sent.
	after(() => syncEntryAfterBind(entryId))

	return {
		entryId,
		teamName: entry.teamName,
		managerName: entry.managerName,
		verifiedAt: boundAt.toISOString()
	}
}

export async function unlinkFplEntry(userId: string): Promise<void> {
	const [updated] = await db
		.update(schema.user)
		.set({
			fplEntryId: null,
			fplEntryBoundAt: null,
			fplEntryVerifiedAt: null,
			fplTeamName: null,
			fplManagerName: null,
			fplIdentityRefreshedAt: null,
			updatedAt: new Date()
		})
		.where(eq(schema.user.id, userId))
		.returning({ id: schema.user.id })

	if (!updated) throw new FplBindingError('Not authenticated', 401)
}

/**
 * Atomically claim the identity-refresh window for this user+entry: exactly
 * one concurrent caller (across tabs/instances) gets true and schedules the
 * post-response lookup; everyone else gets false. Callers should still
 * pre-check staleness from the already-loaded row to keep the hot path
 * write-free — this UPDATE only runs once the snapshot looks stale.
 */
export async function claimFplIdentityRefresh(
	userId: string,
	entryId: number
): Promise<boolean> {
	const now = new Date()
	const staleBefore = new Date(now.getTime() - FPL_IDENTITY_REFRESH_INTERVAL_MS)
	const claimed = await db
		.update(schema.user)
		.set({ fplIdentityRefreshedAt: now })
		.where(
			and(
				eq(schema.user.id, userId),
				eq(schema.user.fplEntryId, entryId),
				or(
					isNull(schema.user.fplIdentityRefreshedAt),
					lt(schema.user.fplIdentityRefreshedAt, staleBefore)
				)
			)
		)
		.returning({ id: schema.user.id })
	return claimed.length > 0
}

/**
 * Re-sync the display-only team/manager name snapshot from FPL and preserve
 * every observed name. Callers can gate this with claimFplIdentityRefresh for
 * background refreshes, or invoke it directly for an explicit profile view.
 *
 * The update is constrained by the still-current fplEntryId: if the user
 * rebinds while this lookup is in flight, the stale snapshot for the old
 * entry cannot overwrite the fresh names stored by the new bind. On FPL
 * failure the claimed window is released (timestamp reset to NULL) so the
 * next profile view retries instead of waiting out a full 24h lockout.
 */
export async function refreshFplIdentitySnapshot(
	userId: string,
	entryId: number
): Promise<void> {
	const entry = await validateFplEntry(entryId)
	if (!entry.valid || !entry.teamName || !entry.managerName) {
		await db
			.update(schema.user)
			.set({ fplIdentityRefreshedAt: null })
			.where(
				and(eq(schema.user.id, userId), eq(schema.user.fplEntryId, entryId))
			)
		return
	}
	const teamName = entry.teamName
	const managerName = entry.managerName

	const refreshedAt = new Date()
	await db.transaction(async tx => {
		const [current] = await tx
			.select({
				fplTeamName: schema.user.fplTeamName,
				fplManagerName: schema.user.fplManagerName,
				fplIdentityRefreshedAt: schema.user.fplIdentityRefreshedAt
			})
			.from(schema.user)
			.where(
				and(eq(schema.user.id, userId), eq(schema.user.fplEntryId, entryId))
			)
			.limit(1)

		if (current?.fplTeamName?.trim()) {
			await tx
				.insert(schema.fplEntryNameHistory)
				.values({
					id: randomUUID(),
					userId,
					entryId,
					teamName: current.fplTeamName.trim(),
					managerName: current.fplManagerName?.trim() || null,
					firstSeenAt: current.fplIdentityRefreshedAt ?? refreshedAt,
					lastSeenAt: current.fplIdentityRefreshedAt ?? refreshedAt
				})
				.onConflictDoNothing()
		}

		await tx
			.insert(schema.fplEntryNameHistory)
			.values({
				id: randomUUID(),
				userId,
				entryId,
				teamName: teamName.trim(),
				managerName: managerName.trim(),
				firstSeenAt: refreshedAt,
				lastSeenAt: refreshedAt
			})
			.onConflictDoNothing()

		await tx
			.update(schema.user)
			.set({
				fplTeamName: teamName,
				fplManagerName: managerName,
				fplIdentityRefreshedAt: refreshedAt
			})
			.where(
				and(eq(schema.user.id, userId), eq(schema.user.fplEntryId, entryId))
			)
	})
}
