import 'server-only'

import { randomBytes, randomInt, randomUUID } from 'crypto'
import { and, desc, eq, gt, isNull } from 'drizzle-orm'

import { db, schema } from '@/lib/db'
import { sendMiniProgramEmailCode } from '@/lib/mailer'
import {
	MiniProgramAuthError,
	assertValidWeChatLoginCode,
	assertValidDeviceId,
	hashMiniProgramSecret,
	hashesEqual,
	isExpired,
	normalizeEmail,
	normalizeOptionalWeChatUnionId,
	normalizeWeChatOpenId,
} from '@/lib/miniprogram-account-core'

const CODE_TTL_MS = 10 * 60 * 1000
const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000
const MAX_ATTEMPTS = 5

function assertMiniProgramPersistenceEnabled(): void {
	if (process.env.MINIPROGRAM_ACCOUNT_STORAGE !== 'true') {
		throw new MiniProgramAuthError(
			'Mini Program account storage is not enabled (set MINIPROGRAM_ACCOUNT_STORAGE=true after creating bauth.mini_program_* tables)',
			503,
		)
	}
}

export interface MiniProgramAccountProfile {
	id: string
	name: string | null
	email: string | null
	emailVerified: boolean
	image: string | null
	createdAt: string
	fplEntryId: number | null
	fplEntryBoundAt: string | null
	wechatLinked: boolean
}

export interface MiniProgramConfirmResult {
	token: string
	profile: MiniProgramAccountProfile
}

export interface MiniProgramWeChatLoginResult {
	linked: boolean
	token?: string
	profile?: MiniProgramAccountProfile
}

interface WeChatIdentity {
	openId: string
	unionId: string | null
}

function generateEmailCode(): string {
	return String(randomInt(0, 1000000)).padStart(6, '0')
}

function generateToken(): string {
	return randomBytes(32).toString('base64url')
}

function mapProfile(user: typeof schema.user.$inferSelect): MiniProgramAccountProfile {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		emailVerified: user.emailVerified,
		image: user.image,
		createdAt: user.createdAt.toISOString(),
		fplEntryId: user.fplEntryId,
		fplEntryBoundAt: user.fplEntryBoundAt?.toISOString() ?? null,
		wechatLinked: Boolean(user.openid),
	}
}

async function createMiniProgramSession(userId: string, deviceId: string): Promise<string> {
	assertMiniProgramPersistenceEnabled()
	const now = new Date()
	const token = generateToken()
	await db.insert(schema.miniProgramSession).values({
		id: randomUUID(),
		tokenHash: hashMiniProgramSecret(token),
		userId,
		deviceId,
		expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
	})

	return token
}

async function assertWeChatIdentityAvailable(identity: WeChatIdentity, userId: string): Promise<void> {
	const [openIdOwner] = await db
		.select({ id: schema.user.id })
		.from(schema.user)
		.where(eq(schema.user.openid, identity.openId))
		.limit(1)

	if (openIdOwner && openIdOwner.id !== userId) {
		throw new MiniProgramAuthError('This WeChat account is already linked to another user', 409)
	}
}

export async function exchangeWeChatLoginCode(codeInput: unknown): Promise<WeChatIdentity> {
	const code = assertValidWeChatLoginCode(codeInput)
	const appId = process.env.WECHAT_MINIPROGRAM_APP_ID
	const appSecret = process.env.WECHAT_MINIPROGRAM_APP_SECRET

	if (!appId || !appSecret) {
		throw new MiniProgramAuthError('WeChat Mini Program login is not configured', 500)
	}

	const params = new URLSearchParams({
		appid: appId,
		secret: appSecret,
		js_code: code,
		grant_type: 'authorization_code',
	})

	const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${params.toString()}`, {
		method: 'GET',
		cache: 'no-store',
	})

	type Code2SessionResponse = {
		openid?: string
		unionid?: string
		errcode?: number
		errmsg?: string
	}

	const payload = await response.json() as Code2SessionResponse
	if (!response.ok || !payload.openid || payload.errcode) {
		throw new MiniProgramAuthError(payload.errmsg || 'WeChat login failed', 401)
	}

	return {
		openId: normalizeWeChatOpenId(payload.openid),
		unionId: normalizeOptionalWeChatUnionId(payload.unionid),
	}
}

export async function startMiniProgramEmailBinding(input: {
	email: unknown
	deviceId: unknown
}): Promise<void> {
	assertMiniProgramPersistenceEnabled()
	const email = normalizeEmail(input.email)
	const deviceId = assertValidDeviceId(input.deviceId)

	const [user] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.email, email))
		.limit(1)

	if (!user) {
		return
	}

	const now = new Date()
	const code = generateEmailCode()

	await db
		.update(schema.miniProgramEmailCode)
		.set({ consumedAt: now })
		.where(and(
			eq(schema.miniProgramEmailCode.email, email),
			eq(schema.miniProgramEmailCode.deviceId, deviceId),
			isNull(schema.miniProgramEmailCode.consumedAt),
		))

	await db.insert(schema.miniProgramEmailCode).values({
		id: randomUUID(),
		email,
		deviceId,
		codeHash: hashMiniProgramSecret(code),
		expiresAt: new Date(now.getTime() + CODE_TTL_MS),
	})

	await sendMiniProgramEmailCode({ to: email, code })
}

export async function confirmMiniProgramEmailBinding(input: {
	email: unknown
	deviceId: unknown
	code: unknown
	wechatCode?: unknown
}): Promise<MiniProgramConfirmResult> {
	assertMiniProgramPersistenceEnabled()
	const email = normalizeEmail(input.email)
	const deviceId = assertValidDeviceId(input.deviceId)
	const code = typeof input.code === 'string' ? input.code.trim() : ''
	if (!/^\d{6}$/.test(code)) {
		throw new MiniProgramAuthError('Enter the 6-digit code', 400)
	}

	const [pending] = await db
		.select()
		.from(schema.miniProgramEmailCode)
		.where(and(
			eq(schema.miniProgramEmailCode.email, email),
			eq(schema.miniProgramEmailCode.deviceId, deviceId),
			isNull(schema.miniProgramEmailCode.consumedAt),
		))
		.orderBy(desc(schema.miniProgramEmailCode.createdAt))
		.limit(1)

	if (!pending || isExpired(pending.expiresAt) || pending.attempts >= MAX_ATTEMPTS) {
		throw new MiniProgramAuthError('Code is invalid or expired', 400)
	}

	if (!hashesEqual(pending.codeHash, hashMiniProgramSecret(code))) {
		await db
			.update(schema.miniProgramEmailCode)
			.set({ attempts: pending.attempts + 1 })
			.where(eq(schema.miniProgramEmailCode.id, pending.id))
		throw new MiniProgramAuthError('Code is invalid or expired', 400)
	}

	const [user] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.email, email))
		.limit(1)

	if (!user) {
		throw new MiniProgramAuthError('Code is invalid or expired', 400)
	}

	const wechatIdentity = input.wechatCode
		? await exchangeWeChatLoginCode(input.wechatCode)
		: null

	if (wechatIdentity) {
		await assertWeChatIdentityAvailable(wechatIdentity, user.id)
	}

	const now = new Date()
	const token = await createMiniProgramSession(user.id, deviceId)

	let linkedUser = user
	if (wechatIdentity) {
		const [updatedUser] = await db
			.update(schema.user)
			.set({
				openid: wechatIdentity.openId,
				updatedAt: now,
			})
			.where(eq(schema.user.id, user.id))
			.returning()

		linkedUser = updatedUser ?? user
	}

	await db
		.update(schema.miniProgramEmailCode)
		.set({ consumedAt: now })
		.where(eq(schema.miniProgramEmailCode.id, pending.id))

	return { token, profile: mapProfile(linkedUser) }
}

export async function signInMiniProgramWithWeChat(input: {
	code: unknown
	deviceId: unknown
}): Promise<MiniProgramWeChatLoginResult> {
	assertMiniProgramPersistenceEnabled()
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

	await assertWeChatIdentityAvailable(identity, user.id)

	const linkedUser = user
	const token = await createMiniProgramSession(user.id, deviceId)
	return { linked: true, token, profile: mapProfile(linkedUser) }
}

export async function getMiniProgramProfileByToken(token: string): Promise<MiniProgramAccountProfile> {
	assertMiniProgramPersistenceEnabled()
	const [session] = await db
		.select()
		.from(schema.miniProgramSession)
		.where(and(
			eq(schema.miniProgramSession.tokenHash, hashMiniProgramSecret(token)),
			gt(schema.miniProgramSession.expiresAt, new Date()),
			isNull(schema.miniProgramSession.revokedAt),
		))
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
	assertMiniProgramPersistenceEnabled()
	await db
		.update(schema.miniProgramSession)
		.set({ revokedAt: new Date() })
		.where(eq(schema.miniProgramSession.tokenHash, hashMiniProgramSecret(token)))
}
