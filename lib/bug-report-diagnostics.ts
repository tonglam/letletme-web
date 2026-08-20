export type BugReportDiagnostic = {
	at: string
	requestId?: string
	message?: string
	operation?: string
}

const MAX_DIAGNOSTICS = 3
const diagnostics: BugReportDiagnostic[] = []

export function recordBugReportDiagnostic(entry: BugReportDiagnostic): void {
	diagnostics.push({
		at: entry.at,
		requestId: entry.requestId?.slice(0, 80),
		message: entry.message?.slice(0, 180),
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
		operations: readBugReportDiagnostics().map(({ requestId, message, operation }) => ({
			...(operation ? { operation } : {}),
			...(requestId ? { requestId } : {}),
			...(message ? { message } : {})
		})),
	}
}
