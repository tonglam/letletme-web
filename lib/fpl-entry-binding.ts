import 'server-only'

import { randomBytes, randomUUID } from 'crypto'
import { and, count, desc, eq, gte, isNull, sql } from 'drizzle-orm'

import { db, schema } from '@/lib/db'
import {
	FPL_BINDING_CHALLENGE_TTL_MS,
	FPL_BINDING_CREATION_LIMIT,
	FPL_BINDING_MAX_ATTEMPTS,
	assertFplEntryId,
	fplTeamNamesMatch,
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
			(error as { code?: unknown }).code === '23505',
	)
}

export async function startFplEntryBindingChallenge(
	userId: string,
	entryIdInput: unknown,
): Promise<FplBindingChallenge> {
	const entryId = assertFplEntryId(entryIdInput)
	const entry = await validateFplEntry(entryId)
	if (!entry.valid || !entry.teamName || !entry.managerName) {
		throw new FplBindingError(
			`No FPL team found with ID ${entryId}. Check your FPL entry number.`,
		)
	}

	const now = new Date()
	const challenge = {
		id: randomUUID(),
		userId,
		entryId,
		requiredName: requiredTeamName(),
		expiresAt: new Date(now.getTime() + FPL_BINDING_CHALLENGE_TTL_MS),
	}

	await db.transaction(async tx => {
		const lockedUsers = await tx.execute<{ id: string }>(
			sql`select id from bauth."user" where id = ${userId} for update`,
		)
		if (!lockedUsers[0]) throw new FplBindingError('Not authenticated', 401)

		const [recent] = await tx
			.select({ value: count() })
			.from(schema.fplEntryBindingChallenge)
			.where(and(
				eq(schema.fplEntryBindingChallenge.userId, userId),
				gte(
					schema.fplEntryBindingChallenge.createdAt,
					new Date(now.getTime() - 60 * 60 * 1000),
				),
			))
		if ((recent?.value ?? 0) >= FPL_BINDING_CREATION_LIMIT) {
			throw new FplBindingError('Too many binding challenges; try again later', 429)
		}

		await tx
			.update(schema.fplEntryBindingChallenge)
			.set({ consumedAt: now, updatedAt: now })
			.where(and(
				eq(schema.fplEntryBindingChallenge.userId, userId),
				isNull(schema.fplEntryBindingChallenge.consumedAt),
			))

		await tx.insert(schema.fplEntryBindingChallenge).values(challenge)
	})

	return {
		id: challenge.id,
		entryId,
		requiredName: challenge.requiredName,
		expiresAt: challenge.expiresAt.toISOString(),
		teamName: entry.teamName,
		managerName: entry.managerName,
	}
}

export async function confirmFplEntryBindingChallenge(
	userId: string,
	challengeId: unknown,
): Promise<{ entryId: number; teamName: string; managerName: string; verifiedAt: string }> {
	if (typeof challengeId !== 'string' || !challengeId) {
		throw new FplBindingError('Binding challenge is required')
	}

	const [pending] = await db
		.select()
		.from(schema.fplEntryBindingChallenge)
		.where(and(
			eq(schema.fplEntryBindingChallenge.id, challengeId),
			eq(schema.fplEntryBindingChallenge.userId, userId),
			isNull(schema.fplEntryBindingChallenge.consumedAt),
		))
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
			await tx.execute(sql`select id from bauth."user" where id = ${userId} for update`)
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
				consumedAt: nextAttempts >= FPL_BINDING_MAX_ATTEMPTS ? attemptNow : null,
				updatedAt: attemptNow,
				})
				.where(eq(schema.fplEntryBindingChallenge.id, challengeId))
		})
		throw new FplBindingError(
			`Team name does not yet match ${pending.requiredName}. Change it in FPL and try again.`,
		)
	}

	try {
		await db.transaction(async tx => {
			const confirmedAt = new Date()
			const lockedUsers = await tx.execute<{ id: string }>(
				sql`select id from bauth."user" where id = ${userId} for update`,
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
				updatedAt: confirmedAt,
				})
				.where(eq(schema.user.id, userId))
			await tx
				.update(schema.fplEntryBindingChallenge)
			.set({ consumedAt: confirmedAt, updatedAt: confirmedAt })
				.where(eq(schema.fplEntryBindingChallenge.id, challengeId))
		})
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new FplBindingError('This FPL entry is already verified by another account', 409)
		}
		throw error
	}

	return {
		entryId: pending.entryId,
		teamName: entry.teamName,
		managerName: entry.managerName,
		verifiedAt: now.toISOString(),
	}
}
