import { createHash } from 'crypto'

export class MiniProgramAuthError extends Error {
	status: number

	constructor(message: string, status = 400) {
		super(message)
		this.name = 'MiniProgramAuthError'
		this.status = status
	}
}

export function normalizeEmail(value: unknown): string {
	if (typeof value !== 'string') {
		throw new MiniProgramAuthError('Email is required', 400)
	}

	const email = value.trim().toLowerCase()
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		throw new MiniProgramAuthError('Enter a valid email address', 400)
	}

	return email
}

export function assertValidDeviceId(value: unknown): string {
	if (typeof value !== 'string') {
		throw new MiniProgramAuthError('deviceId is required', 400)
	}

	const deviceId = value.trim()
	if (deviceId.length < 8 || deviceId.length > 128) {
		throw new MiniProgramAuthError('deviceId must be 8-128 characters', 400)
	}

	return deviceId
}

export function assertValidWeChatLoginCode(value: unknown): string {
	if (typeof value !== 'string') {
		throw new MiniProgramAuthError('wechatCode is required', 400)
	}

	const code = value.trim()
	if (code.length < 8 || code.length > 512 || !/^[A-Za-z0-9_-]+$/.test(code)) {
		throw new MiniProgramAuthError('wechatCode is invalid', 400)
	}

	return code
}

export function normalizeWeChatOpenId(value: unknown): string {
	if (typeof value !== 'string') {
		throw new MiniProgramAuthError('wechatOpenId is required', 400)
	}

	const openId = value.trim()
	if (openId.length < 8 || openId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(openId)) {
		throw new MiniProgramAuthError('wechatOpenId is invalid', 400)
	}

	return openId
}

export function normalizeOptionalWeChatUnionId(value: unknown): string | null {
	if (value === undefined || value === null || value === '') {
		return null
	}

	if (typeof value !== 'string') {
		throw new MiniProgramAuthError('wechatUnionId is invalid', 400)
	}

	const unionId = value.trim()
	if (!unionId) {
		return null
	}

	if (unionId.length < 8 || unionId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(unionId)) {
		throw new MiniProgramAuthError('wechatUnionId is invalid', 400)
	}

	return unionId
}

export function hashMiniProgramSecret(value: string): string {
	return createHash('sha256').update(value).digest('hex')
}

export function getBearerToken(header: string | null): string | null {
	if (!header) return null
	const match = header.match(/^bearer\s+(.+)$/i)
	return match?.[1]?.trim() || null
}

export function isExpired(expiresAt: Date, now = new Date()): boolean {
	return expiresAt.getTime() <= now.getTime()
}
