type RouteNavigationStart = {
	pathname: string
	startedAt: number
}

let currentRouteNavigation: RouteNavigationStart | null = null

const normalizePathname = (pathname: string): string => {
	const normalized = pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '')
	return normalized || '/'
}

/** Called by Next's pre-hydration client instrumentation when a route starts. */
export function markRouteNavigationStart(
	url: string,
	startedAt = performance.now(),
	baseHref = window.location.href
): void {
	try {
		currentRouteNavigation = {
			pathname: normalizePathname(new URL(url, baseHref).pathname),
			startedAt
		}
	} catch {
		// Instrumentation must never interfere with navigation.
		currentRouteNavigation = null
	}
}

function documentNavigationStart(): number {
	const entry = performance.getEntriesByType('navigation')[0] as
		PerformanceNavigationTiming | undefined
	return entry?.startTime ?? 0
}

/** Elapsed time for this route, not for the lifetime of the browser tab. */
export function measureRouteReadyDuration(
	pathname: string,
	now = performance.now(),
	documentStart = documentNavigationStart()
): number {
	const routeStart =
		currentRouteNavigation?.pathname === normalizePathname(pathname)
			? currentRouteNavigation.startedAt
			: documentStart
	return Math.max(0, now - routeStart)
}

export function resetRouteNavigationStartForTests(): void {
	currentRouteNavigation = null
}
