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
	return {
		pathname: window.location.pathname,
		hrefHost: window.location.host,
		locale: document.documentElement.lang || null,
		userAgent: navigator.userAgent,
		timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		clientTime: new Date().toISOString(),
		viewport: { width: window.innerWidth, height: window.innerHeight },
		recentRequests: readBugReportDiagnostics(),
	}
}
