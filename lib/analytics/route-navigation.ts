type RouteNavigationStart = {
	pathname: string
	startedAt: number
}

let currentRouteNavigation: RouteNavigationStart | null = null
const readyInteractionStarts = new Map<string, number>()

type ElementPaintEntry = {
	identifier?: string
	startTime: number
	renderTime?: number
}

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
		readyInteractionStarts.set(
			`${normalizedPathname}\u0000${readyKey}`,
			startedAt
		)
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

/** Returns the latest browser-recorded paint time for one annotated RSC element. */
export function findElementPaintTime(
	identifier: string,
	entries: readonly ElementPaintEntry[],
	notBefore = 0
): number | null {
	let latestPaint: number | null = null
	for (const entry of entries) {
		if (entry.identifier !== identifier) continue
		const paintedAt = entry.renderTime || entry.startTime
		if (
			Number.isFinite(paintedAt) &&
			paintedAt >= notBefore &&
			(latestPaint === null || paintedAt > latestPaint)
		) {
			latestPaint = paintedAt
		}
	}
	return latestPaint
}

/**
 * Chromium exposes Element Timing entries only through PerformanceObserver.
 * Buffered observation also covers a streamed RSC element painted before hydration.
 */
export function observeElementPaintTime(
	identifier: string,
	notBefore = 0,
	timeoutMs = 100
): Promise<number | null> {
	if (
		typeof PerformanceObserver === 'undefined' ||
		!PerformanceObserver.supportedEntryTypes?.includes('element')
	) {
		return Promise.resolve(null)
	}

	return new Promise(resolve => {
		let settled = false
		let timer: ReturnType<typeof setTimeout> | undefined
		const observer = new PerformanceObserver(list => {
			const paintedAt = findElementPaintTime(
				identifier,
				list.getEntries() as ElementPaintEntry[],
				notBefore
			)
			if (paintedAt !== null) finish(paintedAt)
		})
		const finish = (paintedAt: number | null) => {
			if (settled) return
			settled = true
			observer.disconnect()
			if (timer) clearTimeout(timer)
			resolve(paintedAt)
		}

		try {
			observer.observe({ type: 'element', buffered: true })
			timer = setTimeout(() => finish(null), timeoutMs)
		} catch {
			finish(null)
		}
	})
}

/** Elapsed time for this route, not for the lifetime of the browser tab. */
export function routeReadyStartTime(
	pathname: string,
	documentStart = documentNavigationStart(),
	readyKey?: string
): number {
	if (readyKey) {
		const interactionKey = `${normalizePathname(pathname)}\u0000${readyKey}`
		const interactionStart = readyInteractionStarts.get(interactionKey)
		if (interactionStart !== undefined) return interactionStart
	}
	return currentRouteNavigation?.pathname === normalizePathname(pathname)
		? currentRouteNavigation.startedAt
		: documentStart
}

export function measureRouteReadyDuration(
	pathname: string,
	now = performance.now(),
	documentStart = documentNavigationStart(),
	readyKey?: string
): number {
	return Math.max(
		0,
		now - routeReadyStartTime(pathname, documentStart, readyKey)
	)
}

export function resetRouteNavigationStartForTests(): void {
	currentRouteNavigation = null
	readyInteractionStarts.clear()
}
