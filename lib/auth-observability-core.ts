import { createHmac } from 'node:crypto'

export const AUTH_EVENT_RETENTION_DAYS = 45
export const AUTH_EVENT_RETENTION_MS = AUTH_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000
export const AUTH_DEVICE_COOKIE_NAME = 'letletme.auth_device'
export const AUTH_DEVICE_COOKIE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60

export function resolveAuthRelease(): string {
	return (
		process.env.LETLETME_RELEASE_SHA?.trim().slice(0, 12) ||
		process.env.VERCEL_GIT_COMMIT_SHA?.trim().slice(0, 12) ||
		'local'
	)
}

export type AuthChannel = 'web' | 'mini'

export type AuthOutcome = 'started' | 'succeeded' | 'failed' | 'rejected'

export type AuthEventType =
	| 'auth_request'
	| 'session_issued'
	| 'session_renewed'
	| 'session_revoked'
	| 'session_persistence'
	| 'rate_limited'
	| 'upstream_failure'
	| 'account_link'

export type AuthClientEnvironment = {
	browserFamily?: string
	browserMajor?: string
	osFamily?: string
	osMajor?: string
	deviceClass?: 'desktop' | 'phone' | 'tablet' | 'unknown'
}

export type MiniProgramLoginContext = {
	schemaVersion: 1
	trigger:
		| 'cold_start_missing'
		| 'cold_start_expired'
		| 'cold_start_restore_failed'
		| 'profile_401'
		| 'graphql_401'
		| 'account_link'
		| 'session_missing'
	platform?: 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown'
	deviceClass?: 'phone' | 'tablet' | 'desktop' | 'unknown'
	osFamily?: 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown'
	osMajor?: string
	wechatMajor?: string
	sdkVersion?: string
	miniProgramVersion?: string
	envVersion?: 'develop' | 'trial' | 'release' | 'unknown'
	pageRoute?: string
	encryptedStorageSupported?: boolean
	credentialState?:
		| 'missing'
		| 'expired'
		| 'restore_failed'
		| 'encrypted'
		| 'memory_only'
		| 'unknown'
}

export type AuthEventInput = {
	eventType: AuthEventType
	channel: AuthChannel
	operation: string
	outcome: AuthOutcome
	statusCode?: number
	errorCode?: string
	requestId?: string
	webUserId?: string | null
	miniAccountId?: string | null
	email?: string | null
	sessionId?: string | null
	deviceId?: string | null
	ip?: string | null
	trigger?: MiniProgramLoginContext['trigger']
	revokedSessionCount?: number
	phaseTimings?: Record<string, number>
	clientEnvironment?: AuthClientEnvironment
	loginContext?: MiniProgramLoginContext
	credentialState?: NonNullable<MiniProgramLoginContext['credentialState']>
	release?: string
	source?: string
	region?: string
	occurredAt?: Date
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/
const SAFE_VERSION = /^\d{1,4}$/
const SAFE_VERSION_STRING = /^[A-Za-z0-9._-]{1,64}$/
const SAFE_ROUTE = /^[A-Za-z0-9_./-]{1,160}$/
const SAFE_OPERATION = /^[A-Za-z0-9_.:/-]{1,80}$/
const SAFE_SOURCE = /^[A-Za-z0-9_.:/-]{1,80}$/
const SAFE_REGION = /^[A-Za-z0-9_.:/-]{1,80}$/
const SAFE_ERROR_CODE = /^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/

const SAFE_ERROR_CODES = new Set([
	'bad_request',
	'invalid_credentials',
	'invalid_email',
	'email_not_verified',
	'forbidden',
	'unauthorized',
	'rate_limited',
	'service_unavailable',
	'upstream_failure',
	'wechat_upstream_rejected',
	'wechat_upstream_unavailable',
	'session_missing',
	'session_expired',
	'session_revoked',
	'storage_write_failed',
	'storage_unsupported',
	'http_400',
	'http_401',
	'http_403',
	'http_409',
	'http_429',
	'http_500',
	'http_502',
	'http_503',
	'http_504'
])

const SAFE_MINI_PLATFORMS = new Set<NonNullable<MiniProgramLoginContext['platform']>>([
	'ios',
	'android',
	'windows',
	'macos',
	'linux',
	'unknown'
])
const SAFE_MINI_DEVICE_CLASSES = new Set<NonNullable<MiniProgramLoginContext['deviceClass']>>([
	'phone',
	'tablet',
	'desktop',
	'unknown'
])
const SAFE_MINI_ENVIRONMENTS = new Set<NonNullable<MiniProgramLoginContext['envVersion']>>([
	'develop',
	'trial',
	'release',
	'unknown'
])
const SAFE_CREDENTIAL_STATES = new Set<NonNullable<MiniProgramLoginContext['credentialState']>>([
	'missing',
	'expired',
	'restore_failed',
	'encrypted',
	'memory_only',
	'unknown'
])
const SAFE_TRIGGERS = new Set<MiniProgramLoginContext['trigger']>([
	'cold_start_missing',
	'cold_start_expired',
	'cold_start_restore_failed',
	'profile_401',
	'graphql_401',
	'account_link',
	'session_missing'
])

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === 'object' && value !== null
		? (value as Record<string, unknown>)
		: null
}

function boundedSafeString(
	value: unknown,
	pattern: RegExp,
	maxLength: number
): string | undefined {
	if (typeof value !== 'string') return undefined
	const candidate = value.trim().slice(0, maxLength)
	return candidate && pattern.test(candidate) ? candidate : undefined
}

function normalizedMajor(value: unknown): string | undefined {
	if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
		return String(value)
	}
	if (typeof value !== 'string') return undefined
	const major = value.trim().match(/^\d{1,4}/)?.[0]
	return major && SAFE_VERSION.test(major) ? major : undefined
}

function normalizedVersionString(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined
	const candidate = value.trim().slice(0, 64)
	return candidate && SAFE_VERSION_STRING.test(candidate) ? candidate : undefined
}

function enumValue<T extends string>(value: unknown, allowed: ReadonlySet<T>): T | undefined {
	return typeof value === 'string' && allowed.has(value as T)
		? (value as T)
		: undefined
}

export function normalizeRequestId(value: unknown): string | undefined {
	return boundedSafeString(value, REQUEST_ID_PATTERN, 128)
}

export function normalizeAuthOperation(value: unknown): string {
	return boundedSafeString(value, SAFE_OPERATION, 80) ?? 'auth-request'
}

export function normalizeAuthSource(value: unknown): string | undefined {
	return boundedSafeString(value, SAFE_SOURCE, 80)
}

export function normalizeAuthRegion(value: unknown): string | undefined {
	return boundedSafeString(value, SAFE_REGION, 80)
}

export function normalizeAuthErrorCode(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined
	const candidate = value.trim().slice(0, 80)
	if (!SAFE_ERROR_CODE.test(candidate)) return undefined
	return SAFE_ERROR_CODES.has(candidate) ? candidate : undefined
}

export function httpAuthErrorCode(statusCode: number): string | undefined {
	return statusCode >= 400 && statusCode <= 599
		? normalizeAuthErrorCode(`http_${statusCode}`)
		: undefined
}

export function normalizeMiniProgramLoginContext(
	value: unknown
): MiniProgramLoginContext | undefined {
	const record = asRecord(value)
	if (!record || record.schemaVersion !== 1) return undefined
	const trigger = enumValue(record.trigger, SAFE_TRIGGERS)
	if (!trigger) return undefined
	const platform = enumValue(record.platform, SAFE_MINI_PLATFORMS)
	const deviceClass = enumValue(record.deviceClass, SAFE_MINI_DEVICE_CLASSES)
	const osFamily = enumValue(record.osFamily, SAFE_MINI_PLATFORMS)
	const envVersion = enumValue(record.envVersion, SAFE_MINI_ENVIRONMENTS)
	const credentialState = enumValue(record.credentialState, SAFE_CREDENTIAL_STATES)
	const pageRoute =
		boundedSafeString(record.pageRoute, SAFE_ROUTE, 160)?.replace(/^\/+/, '') ||
		undefined
	return {
		schemaVersion: 1,
		trigger,
		...(platform ? { platform } : {}),
		...(deviceClass ? { deviceClass } : {}),
		...(osFamily ? { osFamily } : {}),
		...(normalizedMajor(record.osMajor)
			? { osMajor: normalizedMajor(record.osMajor) }
			: {}),
		...(normalizedMajor(record.wechatMajor)
			? { wechatMajor: normalizedMajor(record.wechatMajor) }
			: {}),
		...(normalizedVersionString(record.sdkVersion)
			? { sdkVersion: normalizedVersionString(record.sdkVersion) }
			: {}),
		...(normalizedVersionString(record.miniProgramVersion)
			? { miniProgramVersion: normalizedVersionString(record.miniProgramVersion) }
			: {}),
		...(envVersion ? { envVersion } : {}),
		...(pageRoute ? { pageRoute } : {}),
		...(typeof record.encryptedStorageSupported === 'boolean'
			? { encryptedStorageSupported: record.encryptedStorageSupported }
			: {}),
		...(credentialState ? { credentialState } : {})
	}
}

export function hmacAuthReference(
	value: unknown,
	purpose: string,
	secret: string | undefined = process.env.AUTH_OBSERVABILITY_SECRET
): string | undefined {
	if (typeof value !== 'string' || !value || !secret) return undefined
	if (Buffer.byteLength(secret, 'utf8') < 32) return undefined
	const safePurpose = boundedSafeString(purpose, SAFE_SOURCE, 40)
	if (!safePurpose) return undefined
	const digest = createHmac('sha256', secret)
		.update(`${safePurpose}:`)
		.update(value)
		.digest('hex')
	return `h1:${safePurpose}:${digest}`
}

export function normalizeIp(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined
	const candidate = value.trim().replace(/^"|"$/g, '')
	if (
		!candidate ||
		candidate === 'unknown' ||
		candidate.length > 128 ||
		/[\r\n]/.test(candidate)
	)
		return undefined
	return candidate
}

export function normalizePhaseTimings(
	value: Record<string, number> | undefined
): Record<string, number> | undefined {
	if (!value) return undefined
	const entries = Object.entries(value)
		.filter(([key, duration]) =>
			SAFE_OPERATION.test(key) &&
			Number.isFinite(duration) &&
			duration >= 0 &&
			duration <= 10 * 60 * 1000
		)
		.slice(0, 24)
		.map(([key, duration]) => [key, Number(duration.toFixed(2))] as const)
	return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

export function normalizeClientEnvironment(
	userAgent: string | null | undefined
): AuthClientEnvironment {
	const value = typeof userAgent === 'string' ? userAgent : ''
	const browser = value.match(/MicroMessenger\/(\d+)/i)
		? ['wechat', value.match(/MicroMessenger\/(\d+)/i)?.[1]]
		: value.match(/(?:OPR|Opera)\/(\d+)/i)
			? ['opera', value.match(/(?:OPR|Opera)\/(\d+)/i)?.[1]]
			: value.match(/(?:Edg|Edge)\/(\d+)/i)
				? ['edge', value.match(/(?:Edg|Edge)\/(\d+)/i)?.[1]]
				: value.match(/(?:Chrome|CriOS)\/(\d+)/i)
					? ['chrome', value.match(/(?:Chrome|CriOS)\/(\d+)/i)?.[1]]
					: value.match(/Firefox\/(\d+)/i)
						? ['firefox', value.match(/Firefox\/(\d+)/i)?.[1]]
						: value.match(/(?:Version)\/(\d+).*Safari\//i)
							? ['safari', value.match(/(?:Version)\/(\d+)/i)?.[1]]
							: undefined
	const os = value.match(/Windows NT (\d+)/i)
		? ['windows', value.match(/Windows NT (\d+)/i)?.[1]]
		: value.match(/Android[ /](\d+)/i)
			? ['android', value.match(/Android[ /](\d+)/i)?.[1]]
			: value.match(/(?:iPhone|iPad).*OS (\d+)/i)
				? ['ios', value.match(/(?:iPhone|iPad).*OS (\d+)/i)?.[1]]
				: value.match(/Mac OS X (\d+)/i)
					? ['macos', value.match(/Mac OS X (\d+)/i)?.[1]]
					: value.match(/Linux(?: armv\d+)?/i)
						? ['linux', undefined]
						: undefined
	const deviceClass = /iPad|Tablet|Android(?!.*Mobile)/i.test(value)
		? 'tablet'
		: /Mobile|iPhone|Android/i.test(value)
			? 'phone'
			: value
				? 'desktop'
				: 'unknown'
	return {
		...(browser?.[0] ? { browserFamily: browser[0] } : {}),
		...(browser?.[1] ? { browserMajor: browser[1] } : {}),
		...(os?.[0] ? { osFamily: os[0] } : {}),
		...(os?.[1] ? { osMajor: os[1] } : {}),
		deviceClass
	}
}

export function authDeviceCookieValueFromHeader(
	header: string | null | undefined
): string | undefined {
	if (!header) return undefined
	const value = header
		.split(';')
		.map(item => item.trim())
		.find(item => item.startsWith(`${AUTH_DEVICE_COOKIE_NAME}=`))
		?.slice(AUTH_DEVICE_COOKIE_NAME.length + 1)
	if (!value || !/^[A-Za-z0-9_-]{22,64}$/.test(value)) return undefined
	return value
}
