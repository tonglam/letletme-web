type AuthLogLevel = 'debug' | 'info' | 'warn' | 'error'

type SafeDiagnostic = {
	type: string
	code?: string
	status?: number
	severity?: string
	constraint?: string
	routine?: string
	cause?: SafeDiagnostic
}

const SAFE_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/
const SAFE_METADATA_VALUE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/
const SAFE_AUTH_EVENTS = new Set([
	'better-auth diagnostic',
	'graphql proxy authorization session lookup failed',
	'telemetry_write_failed'
])

function safeIdentifier(value: unknown): string | undefined {
	return typeof value === 'string' && SAFE_IDENTIFIER.test(value)
		? value
		: undefined
}

function safeMetadataValue(value: unknown): string | undefined {
	return typeof value === 'string' && SAFE_METADATA_VALUE.test(value)
		? value
		: undefined
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === 'object' && value !== null
		? (value as Record<string, unknown>)
		: null
}

function safeDiagnostic(value: unknown, depth = 0): SafeDiagnostic {
	const record = asRecord(value)
	const errorName =
		value instanceof Error ? safeIdentifier(value.name) : undefined
	const type = errorName ?? safeIdentifier(record?.name) ?? typeof value
	const code = safeMetadataValue(record?.code)
	const severity = safeMetadataValue(record?.severity)
	const constraint =
		safeMetadataValue(record?.constraint_name) ??
		safeMetadataValue(record?.constraint)
	const routine = safeMetadataValue(record?.routine)
	const numericStatus =
		typeof record?.status === 'number'
			? record.status
			: typeof record?.statusCode === 'number'
				? record.statusCode
				: undefined
	const status =
		numericStatus !== undefined && Number.isSafeInteger(numericStatus)
			? numericStatus
			: undefined
	const cause =
		depth < 2 && record?.cause !== undefined
			? safeDiagnostic(record.cause, depth + 1)
			: undefined

	return {
		type,
		...(code ? { code } : {}),
		...(status !== undefined ? { status } : {}),
		...(severity ? { severity } : {}),
		...(constraint ? { constraint } : {}),
		...(routine ? { routine } : {}),
		...(cause ? { cause } : {})
	}
}

/**
 * Keep only stable diagnostic categories. Error messages, SQL, parameters,
 * stacks, request headers, cookies, and token-shaped strings are deliberately
 * excluded because auth/database errors can embed live session credentials.
 */
export function safeAuthLogDiagnostics(
	values: readonly unknown[]
): SafeDiagnostic[] {
	return values.map(value => safeDiagnostic(value))
}

export function safeAuthLogEvent(message: string): string {
	const normalized = message.trim()
	return SAFE_AUTH_EVENTS.has(normalized) ? normalized : 'internal auth failure'
}

export function logSafeAuthDiagnostic(
	level: AuthLogLevel,
	event: string,
	...values: unknown[]
): void {
	const payload = {
		level,
		event: safeAuthLogEvent(event),
		diagnostics: safeAuthLogDiagnostics(values)
	}
	if (level === 'error') {
		console.error(JSON.stringify(payload))
		return
	}
	if (level === 'warn') {
		console.warn(JSON.stringify(payload))
		return
	}
	console.info(JSON.stringify(payload))
}
