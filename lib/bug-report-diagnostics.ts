export type BugReportDiagnostic = {
	at: string
	requestId?: string
	code?: string
	status?: number
	retryAfterSeconds?: number
	rateLimitPolicy?: string
	rateLimitScope?: string
	workload?: string
	operation?: string
}

const GRAPHQL_RATE_LIMIT_POLICIES = new Set([
	'graphql-v2',
	'graphql-v3',
	'graphql-v4'
])
const GRAPHQL_RATE_LIMIT_SCOPES = new Set(['global', 'client', 'workload'])
const GRAPHQL_WORKLOADS = new Set([
	'interactive',
	'home',
	'fixtures',
	'market',
	'player-stats',
	'gameweek',
	'public-other'
])
const SAFE_DIAGNOSTIC_CODE = /^[A-Z][A-Z0-9_]{0,79}$/

const boundedString = (
	value: unknown,
	maxLength: number
): string | undefined =>
	typeof value === 'string' && value.length > 0
		? value.slice(0, maxLength)
		: undefined

const allowedEnum = (
	value: unknown,
	allowed: ReadonlySet<string>,
	maxLength: number
): string | undefined => {
	const candidate = boundedString(value, maxLength)
	return candidate && allowed.has(candidate) ? candidate : undefined
}

const MAX_DIAGNOSTICS = 3
const diagnostics: BugReportDiagnostic[] = []

export function recordBugReportDiagnostic(entry: BugReportDiagnostic): void {
	const status = entry.status
	const normalizedStatus =
		typeof status === 'number' &&
		Number.isSafeInteger(status) &&
		status >= 0 &&
		status <= 599
			? status
			: undefined
	const retryAfterSeconds = entry.retryAfterSeconds
	const code = boundedString(entry.code, 80)
	diagnostics.push({
		at: boundedString(entry.at, 40) ?? new Date().toISOString(),
		requestId: boundedString(entry.requestId, 80),
		code: code && SAFE_DIAGNOSTIC_CODE.test(code) ? code : undefined,
		status: normalizedStatus,
		retryAfterSeconds:
			typeof retryAfterSeconds === 'number' &&
			Number.isSafeInteger(retryAfterSeconds) &&
			retryAfterSeconds >= 0 &&
			retryAfterSeconds <= 120
				? retryAfterSeconds
				: undefined,
		rateLimitPolicy: allowedEnum(
			entry.rateLimitPolicy,
			GRAPHQL_RATE_LIMIT_POLICIES,
			32
		),
		rateLimitScope: allowedEnum(
			entry.rateLimitScope,
			GRAPHQL_RATE_LIMIT_SCOPES,
			16
		),
		workload: allowedEnum(entry.workload, GRAPHQL_WORKLOADS, 32),
		operation: boundedString(entry.operation, 80)
	})
	if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.shift()
}

export function readBugReportDiagnostics(): BugReportDiagnostic[] {
	return diagnostics.map(item => ({ ...item }))
}

export function resetBugReportDiagnosticsForTests(): void {
	diagnostics.splice(0, diagnostics.length)
}

export function collectBrowserBugReportMeta(): Record<string, unknown> {
	if (typeof window === 'undefined') return {}
	const userAgent = navigator.userAgent
	const platform = /android/i.test(userAgent)
		? 'android'
		: /iphone|ipad|ipod/i.test(userAgent)
			? 'ios'
			: /macintosh|mac os x/i.test(userAgent)
				? 'macos'
				: /windows/i.test(userAgent)
					? 'windows'
					: /linux/i.test(userAgent)
						? 'linux'
						: 'other'
	const osMajorMatch = userAgent.match(
		/(?:Android |OS |Windows NT |Mac OS X )([0-9]+)/i
	)
	const viewportBucket = (value: number): string =>
		value < 480 ? 'small' : value < 1024 ? 'medium' : 'large'
	return {
		route: window.location.pathname,
		envVersion: 'web',
		clientTime: new Date().toISOString(),
		platform,
		...(osMajorMatch ? { osMajor: Number(osMajorMatch[1]) } : {}),
		language: (document.documentElement.lang || navigator.language || '').slice(
			0,
			32
		),
		viewportBucket: `${viewportBucket(window.innerWidth)}x${viewportBucket(window.innerHeight)}`,
		operations: readBugReportDiagnostics().map(
			({
				at,
				requestId,
				code,
				status,
				retryAfterSeconds,
				rateLimitPolicy,
				rateLimitScope,
				workload,
				operation
			}) => ({
				at,
				...(operation ? { operation } : {}),
				...(requestId ? { requestId } : {}),
				...(code ? { code } : {}),
				...(typeof status === 'number' ? { status } : {}),
				...(typeof retryAfterSeconds === 'number' ? { retryAfterSeconds } : {}),
				...(rateLimitPolicy ? { rateLimitPolicy } : {}),
				...(rateLimitScope ? { rateLimitScope } : {}),
				...(workload ? { workload } : {})
			})
		)
	}
}
