export type BugReportDiagnostic = {
	at: string
	requestId?: string
	code?: string
	status?: number
	operation?: string
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
	diagnostics.push({
		at: entry.at,
		requestId: entry.requestId?.slice(0, 80),
		code: entry.code?.slice(0, 80),
		status: normalizedStatus,
		operation: entry.operation?.slice(0, 80),
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
		language: (document.documentElement.lang || navigator.language || '').slice(0, 32),
		viewportBucket: `${viewportBucket(window.innerWidth)}x${viewportBucket(window.innerHeight)}`,
		operations: readBugReportDiagnostics().map(({ requestId, code, status, operation }) => ({
			...(operation ? { operation } : {}),
			...(requestId ? { requestId } : {}),
			...(code ? { code } : {}),
			...(typeof status === 'number' ? { status } : {})
		})),
	}
}
