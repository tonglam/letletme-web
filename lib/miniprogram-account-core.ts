import { createHash, createHmac, timingSafeEqual } from 'crypto'

import { PublicError } from '@/lib/safe-errors'

export class MiniProgramAuthError extends PublicError {
	status: number
	retryAfterSeconds?: number
	code?: string

	constructor(
		message: string,
		status = 400,
		retryAfterSeconds?: number,
		code?: string
	) {
		super(message, 'MiniProgramAuthError')
		this.status = status
		this.retryAfterSeconds = retryAfterSeconds
		this.code = code
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

export type MiniProgramEntryChoice = 'MINI' | 'WEB'

export function assertMiniProgramEntryChoice(
	value: unknown
): MiniProgramEntryChoice {
	if (value !== 'MINI' && value !== 'WEB') {
		throw new MiniProgramAuthError('entry choice must be MINI or WEB', 400)
	}
	return value
}

export type MiniProgramEntryState = {
	effectiveEntryId: number | null
	effectiveEntrySource: MiniProgramEntryChoice | null
	entryConflict: boolean
}

export function resolveMiniProgramEntryState(input: {
	followEntryId: number | null
	webVerifiedEntryId: number | null
	entryChoice: string | null
	entryChoiceMiniEntryId: number | null
	entryChoiceWebEntryId: number | null
}): MiniProgramEntryState {
	const miniEntryId = input.followEntryId
	const webEntryId = input.webVerifiedEntryId
	if (!miniEntryId && !webEntryId) {
		return {
			effectiveEntryId: null,
			effectiveEntrySource: null,
			entryConflict: false
		}
	}
	if (!miniEntryId) {
		return {
			effectiveEntryId: webEntryId,
			effectiveEntrySource: 'WEB',
			entryConflict: false
		}
	}
	if (!webEntryId || miniEntryId === webEntryId) {
		return {
			effectiveEntryId: miniEntryId,
			effectiveEntrySource: 'MINI',
			entryConflict: false
		}
	}

	const choiceMatchesCurrentPair =
		(input.entryChoice === 'MINI' || input.entryChoice === 'WEB') &&
		input.entryChoiceMiniEntryId === miniEntryId &&
		input.entryChoiceWebEntryId === webEntryId
	const source: MiniProgramEntryChoice = choiceMatchesCurrentPair
		? (input.entryChoice as MiniProgramEntryChoice)
		: 'MINI'
	return {
		effectiveEntryId: source === 'WEB' ? webEntryId : miniEntryId,
		effectiveEntrySource: source,
		entryConflict: !choiceMatchesCurrentPair
	}
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

export function hashMiniProgramChallenge(value: string, pepper: string): string {
	return createHmac('sha256', pepper).update(value).digest('hex')
}

export function hashesEqual(left: string, right: string): boolean {
	const leftBuf = Buffer.from(left)
	const rightBuf = Buffer.from(right)
	if (leftBuf.length !== rightBuf.length) {
		return false
	}
	return timingSafeEqual(leftBuf, rightBuf)
}

export function getBearerToken(header: string | null): string | null {
	if (!header) return null
	const match = header.match(/^bearer\s+(.+)$/i)
	return match?.[1]?.trim() || null
}

export function isExpired(expiresAt: Date, now = new Date()): boolean {
	return expiresAt.getTime() <= now.getTime()
}
