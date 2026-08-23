import 'server-only'

import { randomBytes, randomInt, randomUUID } from 'crypto'
import { and, desc, eq, gt, isNull, or, sql } from 'drizzle-orm'

import { db, schema } from '@/lib/db'
import { parseFplEntryId } from '@/lib/fpl-binding-core'
import { validateFplEntry } from '@/lib/fpl'
import { sendMiniProgramEmailCode } from '@/lib/mailer'
import {
	MiniProgramAuthError,
	assertMiniProgramEntryChoice,
	assertValidDeviceId,
	hashMiniProgramChallenge,
	hashMiniProgramSecret,
	hashesEqual,
	isExpired,
	normalizeEmail,
	resolveMiniProgramEntryState,
	type MiniProgramEntryChoice
} from '@/lib/miniprogram-account-core'
import {
	exchangeWeChatCode,
	type WeChatIdentity
} from '@/lib/wechat-code-exchange'

const CODE_TTL_MS = 10 * 60 * 1000
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_ATTEMPTS = 5

type MiniProgramAccount = typeof schema.miniProgramAccount.$inferSelect
type WebUser = typeof schema.user.$inferSelect
type MiniProgramTransaction = Parameters<
	Parameters<typeof db.transaction>[0]
>[0]

export interface MiniProgramAccountProfile {
	id: string
	name: string | null
	email: string | null
	emailVerified: boolean
	image: string | null
	createdAt: string
	accountMode: 'MINI_ONLY' | 'WEB_LINKED'
	webAccountLinked: boolean
	followEntryId: number | null
	webVerifiedEntryId: number | null
	effectiveEntryId: number | null
	effectiveEntrySource: MiniProgramEntryChoice | null
	entryConflict: boolean
	/** Compatibility fields: these only ever represent a verified Web binding. */
	fplEntryId: number | null
	fplEntryBoundAt: string | null
	fplEntryVerifiedAt: string | null
	wechatLinked: true
}

export interface MiniProgramConfirmResult {
	contractVersion: 2
	authenticated: true
	webAccountLinked: true
	token: string
	expiresAt: string
	profile: MiniProgramAccountProfile
}

export type MiniProgramWeChatLoginResult =
	| {
			contractVersion: 1
			linked: false
	  }
	| {
			contractVersion: 1
			linked: true
			token: string
			expiresAt: string
			profile: MiniProgramAccountProfile
	  }
	| {
			contractVersion: 2
			authenticated: true
			webAccountLinked: boolean
			token: string
			expiresAt: string
			profile: MiniProgramAccountProfile
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

function verifiedWebEntryId(user: WebUser | null): number | null {
	return user?.fplEntryVerifiedAt && user.fplEntryId ? user.fplEntryId : null
}

function mapProfile(
	account: MiniProgramAccount,
	user: WebUser | null
): MiniProgramAccountProfile {
	const webEntryId = verifiedWebEntryId(user)
	const entry = resolveMiniProgramEntryState({
		followEntryId: account.followEntryId,
		webVerifiedEntryId: webEntryId,
		entryChoice: account.entryChoice,
		entryChoiceMiniEntryId: account.entryChoiceMiniEntryId,
		entryChoiceWebEntryId: account.entryChoiceWebEntryId
	})
	const webAccountLinked = Boolean(account.linkedWebUserId && user)
	return {
		id: account.id,
		name: webAccountLinked ? (user?.name ?? null) : null,
		email: webAccountLinked ? (user?.email ?? null) : null,
		emailVerified: webAccountLinked ? (user?.emailVerified ?? false) : false,
		image: webAccountLinked ? (user?.image ?? null) : null,
		createdAt: account.createdAt.toISOString(),
		accountMode: webAccountLinked ? 'WEB_LINKED' : 'MINI_ONLY',
		webAccountLinked,
		followEntryId: account.followEntryId,
		webVerifiedEntryId: webEntryId,
		effectiveEntryId: entry.effectiveEntryId,
		effectiveEntrySource: entry.effectiveEntrySource,
		entryConflict: entry.entryConflict,
		fplEntryId: webEntryId,
		fplEntryBoundAt:
			webEntryId && user?.fplEntryBoundAt
				? user.fplEntryBoundAt.toISOString()
				: null,
		fplEntryVerifiedAt:
			webEntryId && user?.fplEntryVerifiedAt
				? user.fplEntryVerifiedAt.toISOString()
				: null,
		wechatLinked: true
	}
}

function isUniqueViolation(error: unknown): boolean {
	return Boolean(
		error &&
		typeof error === 'object' &&
		'code' in error &&
		(error as { code?: unknown }).code === '23505'
	)
}

async function findOrCreateMiniProgramAccount(input: {
	tx: MiniProgramTransaction
	identity: WeChatIdentity
	now: Date
	legacyWebUserId?: string | null
}): Promise<MiniProgramAccount> {
	await input.tx
		.insert(schema.miniProgramAccount)
		.values({
			id: randomUUID(),
			openid: input.identity.openId,
			unionid: input.identity.unionId,
			// Link the legacy Web user only after the account row is locked below.
			// Keeping the insert standalone gives every auth flow the same
			// account-then-user lock order and avoids a user/account deadlock.
			linkedWebUserId: null,
			linkedAt: null,
			updatedAt: input.now
		})
		.onConflictDoNothing()

	const identityMatch = input.identity.unionId
		? or(
				eq(schema.miniProgramAccount.openid, input.identity.openId),
				eq(schema.miniProgramAccount.unionid, input.identity.unionId)
			)
		: eq(schema.miniProgramAccount.openid, input.identity.openId)
	const accounts = await input.tx
		.select()
		.from(schema.miniProgramAccount)
		.where(identityMatch)
		.for('update')
	const byOpenId = accounts.find(
		account => account.openid === input.identity.openId
	)
	const byUnionId = input.identity.unionId
		? accounts.find(account => account.unionid === input.identity.unionId)
		: undefined
	if (byOpenId && byUnionId && byOpenId.id !== byUnionId.id) {
		throw new MiniProgramAuthError('WeChat identity is already in use', 409)
	}
	let account = byOpenId ?? byUnionId
	if (!account) throw new MiniProgramAuthError('Unauthenticated', 401)
	if (
		account.unionid &&
		input.identity.unionId &&
		account.unionid !== input.identity.unionId
	) {
		throw new MiniProgramAuthError('WeChat identity is already in use', 409)
	}
	if (
		input.legacyWebUserId &&
		account.linkedWebUserId &&
		account.linkedWebUserId !== input.legacyWebUserId
	) {
		throw new MiniProgramAuthError('WeChat identity is already in use', 409)
	}

	if (input.legacyWebUserId) {
		const [legacyUser] = await input.tx
			.select({ id: schema.user.id, openid: schema.user.openid })
			.from(schema.user)
			.where(eq(schema.user.id, input.legacyWebUserId))
			.limit(1)
			.for('update')
		if (!legacyUser || legacyUser.openid !== input.identity.openId) {
			throw new MiniProgramAuthError('Unauthenticated', 401)
		}
	}

	const unionid = account.unionid ?? input.identity.unionId
	const linkedWebUserId =
		account.linkedWebUserId ?? input.legacyWebUserId ?? null
	if (
		unionid !== account.unionid ||
		linkedWebUserId !== account.linkedWebUserId
	) {
		;[account] = await input.tx
			.update(schema.miniProgramAccount)
			.set({
				unionid,
				linkedWebUserId,
				linkedAt:
					linkedWebUserId && !account.linkedWebUserId
						? input.now
						: account.linkedAt,
				updatedAt: input.now
			})
			.where(eq(schema.miniProgramAccount.id, account.id))
			.returning()
	}
	if (!account) throw new MiniProgramAuthError('Unauthenticated', 401)
	return account
}

async function loadWebUser(userId: string | null): Promise<WebUser | null> {
	if (!userId) return null
	const [user] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.id, userId))
		.limit(1)
	return user ?? null
}

async function loadAccountProfile(
	accountId: string
): Promise<MiniProgramAccountProfile> {
	const [account] = await db
		.select()
		.from(schema.miniProgramAccount)
		.where(eq(schema.miniProgramAccount.id, accountId))
		.limit(1)
	if (!account) throw new MiniProgramAuthError('Unauthenticated', 401)
	return mapProfile(account, await loadWebUser(account.linkedWebUserId))
}

async function resolveAccountByToken(token: string): Promise<{
	sessionId: string
	account: MiniProgramAccount
}> {
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
	if (!session) throw new MiniProgramAuthError('Unauthenticated', 401)

	let account: MiniProgramAccount | undefined
	if (session.accountId) {
		;[account] = await db
			.select()
			.from(schema.miniProgramAccount)
			.where(eq(schema.miniProgramAccount.id, session.accountId))
			.limit(1)
	}
	if (!account && session.userId) {
		;[account] = await db
			.select()
			.from(schema.miniProgramAccount)
			.where(eq(schema.miniProgramAccount.linkedWebUserId, session.userId))
			.limit(1)
	}
	if (!account) throw new MiniProgramAuthError('Unauthenticated', 401)
	return { sessionId: session.id, account }
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
	const identity = await exchangeWeChatLoginCode(input.wechatCode)
	const now = new Date()
	const token = generateToken()
	const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)

	try {
		const result = await db.transaction(async tx => {
			const account = await findOrCreateMiniProgramAccount({
				tx,
				identity,
				now
			})

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
					.set({
						attempts: sql`${schema.miniProgramEmailCode.attempts} + 1`
					})
					.where(
						and(
							eq(schema.miniProgramEmailCode.id, pending.id),
							sql`${schema.miniProgramEmailCode.attempts} < ${MAX_ATTEMPTS}`
						)
					)
				return { kind: 'invalid' as const }
			}

			if (account.linkedWebUserId && account.linkedWebUserId !== user.id) {
				return { kind: 'conflict' as const }
			}
			const [otherAccount] = await tx
				.select({ id: schema.miniProgramAccount.id })
				.from(schema.miniProgramAccount)
				.where(eq(schema.miniProgramAccount.linkedWebUserId, user.id))
				.limit(1)
			if (otherAccount && otherAccount.id !== account.id) {
				return { kind: 'conflict' as const }
			}
			if (user.openid && user.openid !== identity.openId) {
				return { kind: 'conflict' as const }
			}

			await tx
				.update(schema.miniProgramAccount)
				.set({
					linkedWebUserId: user.id,
					linkedAt: now,
					unionid: account.unionid ?? identity.unionId,
					entryChoice: null,
					entryChoiceMiniEntryId: null,
					entryChoiceWebEntryId: null,
					updatedAt: now
				})
				.where(eq(schema.miniProgramAccount.id, account.id))
			await tx
				.update(schema.user)
				.set({ openid: identity.openId, updatedAt: now })
				.where(eq(schema.user.id, user.id))
			await tx
				.update(schema.miniProgramSession)
				.set({ userId: user.id })
				.where(
					and(
						eq(schema.miniProgramSession.accountId, account.id),
						isNull(schema.miniProgramSession.revokedAt)
					)
				)
			await tx
				.update(schema.miniProgramSession)
				.set({ revokedAt: now })
				.where(
					and(
						eq(schema.miniProgramSession.accountId, account.id),
						eq(schema.miniProgramSession.deviceId, deviceId),
						isNull(schema.miniProgramSession.revokedAt)
					)
				)
			await tx.insert(schema.miniProgramSession).values({
				id: randomUUID(),
				tokenHash: hashMiniProgramSecret(token),
				accountId: account.id,
				userId: user.id,
				deviceId,
				expiresAt,
				lastUsedAt: now
			})
			await tx
				.update(schema.miniProgramEmailCode)
				.set({ consumedAt: now })
				.where(eq(schema.miniProgramEmailCode.id, pending.id))
			return { kind: 'ok' as const, accountId: account.id }
		})

		if (result.kind === 'invalid') {
			throw new MiniProgramAuthError('Code is invalid or expired', 400)
		}
		if (result.kind === 'conflict') {
			throw new MiniProgramAuthError(
				'This Web account is already linked to another WeChat account',
				409
			)
		}
		return {
			contractVersion: 2,
			authenticated: true,
			webAccountLinked: true,
			token,
			expiresAt: expiresAt.toISOString(),
			profile: await loadAccountProfile(result.accountId)
		}
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new MiniProgramAuthError(
				'This Web account is already linked to another WeChat account',
				409
			)
		}
		throw error
	}
}

async function signInStandaloneMiniProgram(input: {
	identity: WeChatIdentity
	deviceId: string
}): Promise<MiniProgramWeChatLoginResult> {
	const now = new Date()
	const token = generateToken()
	const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)
	const accountId = await db.transaction(async tx => {
		const [legacyUser] = await tx
			.select()
			.from(schema.user)
			.where(eq(schema.user.openid, input.identity.openId))
			.limit(1)

		const account = await findOrCreateMiniProgramAccount({
			tx,
			identity: input.identity,
			now,
			legacyWebUserId: legacyUser?.id
		})

		await tx
			.update(schema.miniProgramSession)
			.set({ revokedAt: now })
			.where(
				and(
					eq(schema.miniProgramSession.accountId, account.id),
					eq(schema.miniProgramSession.deviceId, input.deviceId),
					isNull(schema.miniProgramSession.revokedAt)
				)
			)
		await tx.insert(schema.miniProgramSession).values({
			id: randomUUID(),
			tokenHash: hashMiniProgramSecret(token),
			accountId: account.id,
			userId: account.linkedWebUserId,
			deviceId: input.deviceId,
			expiresAt,
			lastUsedAt: now
		})
		return account.id
	})
	const profile = await loadAccountProfile(accountId)
	return {
		contractVersion: 2,
		authenticated: true,
		webAccountLinked: profile.webAccountLinked,
		token,
		expiresAt: expiresAt.toISOString(),
		profile
	}
}

async function signInLegacyMiniProgram(input: {
	identity: WeChatIdentity
	deviceId: string
}): Promise<MiniProgramWeChatLoginResult> {
	const [user] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.openid, input.identity.openId))
		.limit(1)
	if (!user) return { contractVersion: 1, linked: false }

	const now = new Date()
	const token = generateToken()
	const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)
	const accountId = await db.transaction(async tx => {
		const account = await findOrCreateMiniProgramAccount({
			tx,
			identity: input.identity,
			now,
			legacyWebUserId: user.id
		})
		if (!account || account.linkedWebUserId !== user.id) {
			throw new MiniProgramAuthError('Unauthenticated', 401)
		}
		await tx
			.update(schema.miniProgramSession)
			.set({ revokedAt: now })
			.where(
				and(
					eq(schema.miniProgramSession.accountId, account.id),
					eq(schema.miniProgramSession.deviceId, input.deviceId),
					isNull(schema.miniProgramSession.revokedAt)
				)
			)
		await tx.insert(schema.miniProgramSession).values({
			id: randomUUID(),
			tokenHash: hashMiniProgramSecret(token),
			accountId: account.id,
			userId: user.id,
			deviceId: input.deviceId,
			expiresAt,
			lastUsedAt: now
		})
		return account.id
	})
	return {
		contractVersion: 1,
		linked: true,
		token,
		expiresAt: expiresAt.toISOString(),
		profile: await loadAccountProfile(accountId)
	}
}

export async function signInMiniProgramWithWeChat(input: {
	code: unknown
	deviceId: unknown
	contractVersion?: unknown
}): Promise<MiniProgramWeChatLoginResult> {
	const identity = await exchangeWeChatLoginCode(input.code)
	const deviceId = assertValidDeviceId(input.deviceId)
	return input.contractVersion === 2
		? signInStandaloneMiniProgram({ identity, deviceId })
		: signInLegacyMiniProgram({ identity, deviceId })
}

export async function getMiniProgramProfileByToken(
	token: string
): Promise<MiniProgramAccountProfile> {
	const { sessionId, account } = await resolveAccountByToken(token)
	await db
		.update(schema.miniProgramSession)
		.set({ lastUsedAt: new Date() })
		.where(eq(schema.miniProgramSession.id, sessionId))
	return mapProfile(account, await loadWebUser(account.linkedWebUserId))
}

export async function setMiniProgramFollowEntry(
	token: string,
	entryIdInput: unknown
): Promise<MiniProgramAccountProfile> {
	const entryId = parseFplEntryId(entryIdInput)
	if (!entryId) throw new MiniProgramAuthError('请输入有效的参赛 ID', 400)
	const { account } = await resolveAccountByToken(token)
	const entry = await validateFplEntry(entryId)
	if (!entry.valid) {
		throw new MiniProgramAuthError(`没有找到 FPL 球队 #${entryId}`, 404)
	}
	await db
		.update(schema.miniProgramAccount)
		.set({
			followEntryId: entryId,
			entryChoice: null,
			entryChoiceMiniEntryId: null,
			entryChoiceWebEntryId: null,
			updatedAt: new Date()
		})
		.where(eq(schema.miniProgramAccount.id, account.id))
	return loadAccountProfile(account.id)
}

export async function clearMiniProgramFollowEntry(
	token: string
): Promise<MiniProgramAccountProfile> {
	const { account } = await resolveAccountByToken(token)
	await db
		.update(schema.miniProgramAccount)
		.set({
			followEntryId: null,
			entryChoice: null,
			entryChoiceMiniEntryId: null,
			entryChoiceWebEntryId: null,
			updatedAt: new Date()
		})
		.where(eq(schema.miniProgramAccount.id, account.id))
	return loadAccountProfile(account.id)
}

export async function chooseMiniProgramEntrySource(input: {
	token: string
	choice: unknown
	miniEntryId: unknown
	webEntryId: unknown
}): Promise<MiniProgramAccountProfile> {
	const choice = assertMiniProgramEntryChoice(input.choice)
	const miniEntryId = parseFplEntryId(input.miniEntryId)
	const webEntryId = parseFplEntryId(input.webEntryId)
	if (!miniEntryId || !webEntryId || miniEntryId === webEntryId) {
		throw new MiniProgramAuthError('球队冲突状态已变化，请刷新后重试', 409)
	}
	const { account } = await resolveAccountByToken(input.token)
	const user = await loadWebUser(account.linkedWebUserId)
	if (
		account.followEntryId !== miniEntryId ||
		verifiedWebEntryId(user) !== webEntryId
	) {
		throw new MiniProgramAuthError('球队冲突状态已变化，请刷新后重试', 409)
	}
	await db
		.update(schema.miniProgramAccount)
		.set({
			entryChoice: choice,
			entryChoiceMiniEntryId: miniEntryId,
			entryChoiceWebEntryId: webEntryId,
			updatedAt: new Date()
		})
		.where(eq(schema.miniProgramAccount.id, account.id))
	return loadAccountProfile(account.id)
}

export async function unlinkMiniProgramWebAccount(
	token: string
): Promise<MiniProgramAccountProfile> {
	const resolved = await resolveAccountByToken(token)
	const now = new Date()
	await db.transaction(async tx => {
		const [account] = await tx
			.select()
			.from(schema.miniProgramAccount)
			.where(eq(schema.miniProgramAccount.id, resolved.account.id))
			.limit(1)
			.for('update')
		if (!account) throw new MiniProgramAuthError('Unauthenticated', 401)
		if (account.linkedWebUserId) {
			await tx
				.update(schema.user)
				.set({ openid: null, updatedAt: now })
				.where(eq(schema.user.id, account.linkedWebUserId))
		}
		await tx
			.update(schema.miniProgramAccount)
			.set({
				linkedWebUserId: null,
				linkedAt: null,
				entryChoice: null,
				entryChoiceMiniEntryId: null,
				entryChoiceWebEntryId: null,
				updatedAt: now
			})
			.where(eq(schema.miniProgramAccount.id, account.id))
		await tx
			.update(schema.miniProgramSession)
			.set({ userId: null })
			.where(
				and(
					eq(schema.miniProgramSession.accountId, account.id),
					isNull(schema.miniProgramSession.revokedAt)
				)
			)
	})
	return loadAccountProfile(resolved.account.id)
}

export async function revokeMiniProgramSession(token: string): Promise<void> {
	await db
		.update(schema.miniProgramSession)
		.set({ revokedAt: new Date() })
		.where(
			eq(schema.miniProgramSession.tokenHash, hashMiniProgramSecret(token))
		)
}
