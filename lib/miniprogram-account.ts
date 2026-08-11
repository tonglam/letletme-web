import 'server-only'

import { randomBytes, randomInt, randomUUID } from 'crypto'
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm'

import { db, schema } from '@/lib/db'
import { sendMiniProgramEmailCode } from '@/lib/mailer'
import {
	MiniProgramAuthError,
	assertValidDeviceId,
	hashMiniProgramSecret,
	hashMiniProgramChallenge,
	hashesEqual,
	isExpired,
	normalizeEmail
} from '@/lib/miniprogram-account-core'
import {
	exchangeWeChatCode,
	type WeChatIdentity
} from '@/lib/wechat-code-exchange'

const CODE_TTL_MS = 10 * 60 * 1000
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_ATTEMPTS = 5

export interface MiniProgramAccountProfile {
	id: string
	name: string | null
	email: string | null
	emailVerified: boolean
	image: string | null
	createdAt: string
	fplEntryId: number | null
	fplEntryBoundAt: string | null
	fplEntryVerifiedAt: string | null
	wechatLinked: boolean
}

export interface MiniProgramConfirmResult {
	token: string
	expiresAt: string
	profile: MiniProgramAccountProfile
}

export interface MiniProgramWeChatLoginResult {
	linked: boolean
	token?: string
	expiresAt?: string
	profile?: MiniProgramAccountProfile
}

function generateEmailCode(): string {
	return String(randomInt(0, 1000000)).padStart(6, '0')
}

function generateToken(): string {
	return randomBytes(32).toString('base64url')
}

function hashEmailCode(code: string): string {
	const pepper = process.env.BETTER_AUTH_SECRET
	if (!pepper) {
		throw new MiniProgramAuthError(
			'Mini Program account security is not configured',
			503
		)
	}
	return hashMiniProgramChallenge(code, pepper)
}

function mapProfile(
	user: typeof schema.user.$inferSelect
): MiniProgramAccountProfile {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		emailVerified: user.emailVerified,
		image: user.image,
		createdAt: user.createdAt.toISOString(),
		fplEntryId: user.fplEntryId,
		fplEntryBoundAt: user.fplEntryBoundAt?.toISOString() ?? null,
		fplEntryVerifiedAt: user.fplEntryVerifiedAt?.toISOString() ?? null,
		wechatLinked: Boolean(user.openid)
	}
}

function isUniqueViolation(error: unknown): boolean {
	return Boolean(
		error &&
		typeof error === 'object' &&
		'code' in error &&
		error.code === '23505'
	)
}

export async function exchangeWeChatLoginCode(
	codeInput: unknown
): Promise<WeChatIdentity> {
	return exchangeWeChatCode({
		codeInput,
		appId: process.env.WECHAT_MINIPROGRAM_APP_ID,
		appSecret: process.env.WECHAT_MINIPROGRAM_APP_SECRET
	})
}

export async function startMiniProgramEmailBinding(input: {
	email: unknown
	deviceId: unknown
}): Promise<void> {
	const email = normalizeEmail(input.email)
	const deviceId = assertValidDeviceId(input.deviceId)

	const now = new Date()
	const code = generateEmailCode()
	const found = await db.transaction(async tx => {
		// User is always locked before pending codes to match confirmation/challenge ordering.
		const [user] = await tx
			.select({ id: schema.user.id })
			.from(schema.user)
			.where(eq(schema.user.email, email))
			.limit(1)
			.for('update')
		if (!user) return false

		await tx
			.update(schema.miniProgramEmailCode)
			.set({ consumedAt: now })
			.where(
				and(
					eq(schema.miniProgramEmailCode.email, email),
					eq(schema.miniProgramEmailCode.deviceId, deviceId),
					isNull(schema.miniProgramEmailCode.consumedAt)
				)
			)
		await tx.insert(schema.miniProgramEmailCode).values({
			id: randomUUID(),
			email,
			deviceId,
			codeHash: hashEmailCode(code),
			expiresAt: new Date(now.getTime() + CODE_TTL_MS)
		})
		return true
	})
	if (!found) return

	await sendMiniProgramEmailCode({ to: email, code })
}

export async function confirmMiniProgramEmailBinding(input: {
	email: unknown
	deviceId: unknown
	code: unknown
	wechatCode: unknown
}): Promise<MiniProgramConfirmResult> {
	const email = normalizeEmail(input.email)
	const deviceId = assertValidDeviceId(input.deviceId)
	const code = typeof input.code === 'string' ? input.code.trim() : ''
	if (!/^\d{6}$/.test(code)) {
		throw new MiniProgramAuthError('Enter the 6-digit code', 400)
	}
	// The network exchange is deliberately outside the database transaction.
	const wechatIdentity = await exchangeWeChatLoginCode(input.wechatCode)
	const now = new Date()
	const token = generateToken()
	const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)
	try {
		const result = await db.transaction(async tx => {
			const [user] = await tx
				.select()
				.from(schema.user)
				.where(eq(schema.user.email, email))
				.limit(1)
				.for('update')
			if (!user) return { kind: 'invalid' as const }

			const [pending] = await tx
				.select()
				.from(schema.miniProgramEmailCode)
				.where(
					and(
						eq(schema.miniProgramEmailCode.email, email),
						eq(schema.miniProgramEmailCode.deviceId, deviceId),
						isNull(schema.miniProgramEmailCode.consumedAt)
					)
				)
				.orderBy(desc(schema.miniProgramEmailCode.createdAt))
				.limit(1)
				.for('update')
			if (
				!pending ||
				isExpired(pending.expiresAt) ||
				pending.attempts >= MAX_ATTEMPTS
			) {
				return { kind: 'invalid' as const }
			}
			if (!hashesEqual(pending.codeHash, hashEmailCode(code))) {
				await tx
					.update(schema.miniProgramEmailCode)
					.set({ attempts: sql`${schema.miniProgramEmailCode.attempts} + 1` })
					.where(
						and(
							eq(schema.miniProgramEmailCode.id, pending.id),
							sql`${schema.miniProgramEmailCode.attempts} < ${MAX_ATTEMPTS}`
						)
					)
				return { kind: 'invalid' as const }
			}

			const [owner] = await tx
				.select({ id: schema.user.id })
				.from(schema.user)
				.where(eq(schema.user.openid, wechatIdentity.openId))
				.limit(1)
			if (owner && owner.id !== user.id) return { kind: 'conflict' as const }

			const [linkedUser] = await tx
				.update(schema.user)
				.set({ openid: wechatIdentity.openId, updatedAt: now })
				.where(eq(schema.user.id, user.id))
				.returning()
			await tx
				.update(schema.miniProgramSession)
				.set({ revokedAt: now })
				.where(
					and(
						eq(schema.miniProgramSession.userId, user.id),
						eq(schema.miniProgramSession.deviceId, deviceId),
						isNull(schema.miniProgramSession.revokedAt)
					)
				)
			await tx.insert(schema.miniProgramSession).values({
				id: randomUUID(),
				tokenHash: hashMiniProgramSecret(token),
				userId: user.id,
				deviceId,
				expiresAt,
				lastUsedAt: now
			})
			await tx
				.update(schema.miniProgramEmailCode)
				.set({ consumedAt: now })
				.where(eq(schema.miniProgramEmailCode.id, pending.id))
			return { kind: 'ok' as const, user: linkedUser ?? user }
		})
		if (result.kind === 'invalid')
			throw new MiniProgramAuthError('Code is invalid or expired', 400)
		if (result.kind === 'conflict')
			throw new MiniProgramAuthError(
				'This WeChat account is already linked to another user',
				409
			)
		return {
			token,
			expiresAt: expiresAt.toISOString(),
			profile: mapProfile(result.user)
		}
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new MiniProgramAuthError(
				'This WeChat account is already linked to another user',
				409
			)
		}
		throw error
	}
}

export async function signInMiniProgramWithWeChat(input: {
	code: unknown
	deviceId: unknown
}): Promise<MiniProgramWeChatLoginResult> {
	const identity = await exchangeWeChatLoginCode(input.code)
	const deviceId = assertValidDeviceId(input.deviceId)

	const [user] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.openid, identity.openId))
		.limit(1)

	if (!user) {
		return { linked: false }
	}

	const now = new Date()
	const token = generateToken()
	const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)
	const linkedUser = await db.transaction(async tx => {
		const [lockedUser] = await tx
			.select()
			.from(schema.user)
			.where(eq(schema.user.id, user.id))
			.limit(1)
			.for('update')
		if (!lockedUser || lockedUser.openid !== identity.openId) {
			throw new MiniProgramAuthError('Unauthenticated', 401)
		}
		await tx
			.update(schema.miniProgramSession)
			.set({ revokedAt: now })
			.where(
				and(
					eq(schema.miniProgramSession.userId, lockedUser.id),
					eq(schema.miniProgramSession.deviceId, deviceId),
					isNull(schema.miniProgramSession.revokedAt)
				)
			)
		await tx.insert(schema.miniProgramSession).values({
			id: randomUUID(),
			tokenHash: hashMiniProgramSecret(token),
			userId: lockedUser.id,
			deviceId,
			expiresAt,
			lastUsedAt: now
		})
		return lockedUser
	})
	return {
		linked: true,
		token,
		expiresAt: expiresAt.toISOString(),
		profile: mapProfile(linkedUser)
	}
}

export async function getMiniProgramProfileByToken(
	token: string
): Promise<MiniProgramAccountProfile> {
	const [session] = await db
		.select()
		.from(schema.miniProgramSession)
		.where(
			and(
				eq(schema.miniProgramSession.tokenHash, hashMiniProgramSecret(token)),
				gt(schema.miniProgramSession.expiresAt, new Date()),
				isNull(schema.miniProgramSession.revokedAt)
			)
		)
		.limit(1)

	if (!session) {
		throw new MiniProgramAuthError('Unauthenticated', 401)
	}

	const [user] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.id, session.userId))
		.limit(1)

	if (!user) {
		throw new MiniProgramAuthError('Unauthenticated', 401)
	}

	await db
		.update(schema.miniProgramSession)
		.set({ lastUsedAt: new Date() })
		.where(eq(schema.miniProgramSession.id, session.id))

	return mapProfile(user)
}

export async function revokeMiniProgramSession(token: string): Promise<void> {
	await db
		.update(schema.miniProgramSession)
		.set({ revokedAt: new Date() })
		.where(
			eq(schema.miniProgramSession.tokenHash, hashMiniProgramSecret(token))
		)
}
