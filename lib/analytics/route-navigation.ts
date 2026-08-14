type RouteNavigationStart = {
	pathname: string
	startedAt: number
}

let currentRouteNavigation: RouteNavigationStart | null = null
const readyInteractionStarts = new Map<string, number>()

const normalizePathname = (pathname: string): string => {
	const normalized = pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '')
	return normalized || '/'
}

/** Starts a content-ready clock for an in-page interaction without a router navigation. */
export function markRouteReadyStart(
	pathname: string,
	startedAt = performance.now(),
	readyKey?: string
): void {
	const normalizedPathname = normalizePathname(pathname)
	if (readyKey) {
		readyInteractionStarts.set(`${normalizedPathname}\u0000${readyKey}`, startedAt)
		return
	}
	currentRouteNavigation = { pathname: normalizedPathname, startedAt }
}

/** Called by Next's pre-hydration client instrumentation when a route starts. */
export function markRouteNavigationStart(
	url: string,
	startedAt = performance.now(),
	baseHref = window.location.href
): void {
	try {
		markRouteReadyStart(new URL(url, baseHref).pathname, startedAt)
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
	documentStart = documentNavigationStart(),
	readyKey?: string
): number {
	if (readyKey) {
		const interactionKey = `${normalizePathname(pathname)}\u0000${readyKey}`
		const interactionStart = readyInteractionStarts.get(interactionKey)
		if (interactionStart !== undefined) {
			return Math.max(0, now - interactionStart)
		}
	}
	const routeStart =
		currentRouteNavigation?.pathname === normalizePathname(pathname)
			? currentRouteNavigation.startedAt
			: documentStart
	return Math.max(0, now - routeStart)
}

export function resetRouteNavigationStartForTests(): void {
	currentRouteNavigation = null
	readyInteractionStarts.clear()
}
