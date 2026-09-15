type RouteNavigationStart = {
	pathname: string
	startedAt: number
}

type BackgroundResumeStart = RouteNavigationStart

export type RouteReadyMeasurementKind =
	| 'initial_navigation'
	| 'in_page_navigation'
	| 'interaction'
	| 'background_resume'
	| 'missing_start'

export type RouteReadyKeyKind = 'identity' | 'interaction'

let currentRouteNavigation: RouteNavigationStart | null = null
let pendingBackgroundResume: BackgroundResumeStart | null = null
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
		pendingBackgroundResume = null
		markRouteReadyStart(new URL(url, baseHref).pathname, startedAt)
	} catch {
		// Instrumentation must never interfere with navigation.
		currentRouteNavigation = null
	}
}

/** Starts a clock for content that becomes ready after a background resume. */
export function markBackgroundResumeStart(
	pathname: string,
	startedAt = performance.now()
): void {
	// A visibility resume starts a fresh measurement context. A stale route
	// navigation clock must not win classification for the resumed page.
	currentRouteNavigation = null
	pendingBackgroundResume = {
		pathname: normalizePathname(pathname),
		startedAt
	}
}

function documentNavigationStart(): number | null {
	const entry = performance.getEntriesByType('navigation')[0] as
		PerformanceNavigationTiming | undefined
	return entry?.startTime ?? null
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

/**
 * Resolves after the browser has had a paint opportunity for a hydrated marker.
 * Element Timing only reports elements that enter the viewport, so streamed RSC
 * content below the fold needs a conservative, bounded fallback.
 */
export function nextPaintOpportunityTime(timeoutMs = 250): Promise<number> {
	if (typeof requestAnimationFrame !== 'function') {
		return Promise.resolve(performance.now())
	}

	return new Promise(resolve => {
		let settled = false
		const finish = () => {
			if (settled) return
			settled = true
			clearTimeout(timer)
			resolve(performance.now())
		}
		const timer = setTimeout(finish, timeoutMs)
		requestAnimationFrame(() => requestAnimationFrame(finish))
	})
}

/** Elapsed time for this route, not for the lifetime of the browser tab. */
export function routeReadyStartTime(
	pathname: string,
	documentStart = documentNavigationStart(),
	readyKey?: string,
	readyKeyKind: RouteReadyKeyKind = 'identity'
): number | null {
	if (readyKey) {
		const interactionKey = `${normalizePathname(pathname)}\u0000${readyKey}`
		const interactionStart = readyInteractionStarts.get(interactionKey)
		if (interactionStart !== undefined) return interactionStart
		// A report identity is not itself an interaction clock. Only an explicitly
		// declared interaction key treats a missing start as unavailable; identity
		// keys continue to use the applicable navigation/document context.
		if (readyKeyKind === 'interaction') return null
	}
	if (currentRouteNavigation) {
		return currentRouteNavigation.pathname === normalizePathname(pathname)
			? currentRouteNavigation.startedAt
			: null
	}
	if (pendingBackgroundResume) {
		if (
			pendingBackgroundResume.pathname === normalizePathname(pathname) &&
			performance.now() - pendingBackgroundResume.startedAt <= 60_000
		)
			return pendingBackgroundResume.startedAt
		pendingBackgroundResume = null
	}
	return documentStart
}

/** Classify the clock without putting missing starts into the latency distribution. */
export function routeReadyMeasurementKind(
	pathname: string,
	documentStart = documentNavigationStart(),
	readyKey?: string,
	readyKeyKind: RouteReadyKeyKind = 'identity'
): RouteReadyMeasurementKind {
	if (readyKey) {
		const interactionKey = `${normalizePathname(pathname)}\u0000${readyKey}`
		if (readyInteractionStarts.has(interactionKey)) return 'interaction'
		if (readyKeyKind === 'interaction') return 'missing_start'
	}
	if (currentRouteNavigation?.pathname === normalizePathname(pathname)) {
		return 'in_page_navigation'
	}
	if (pendingBackgroundResume) {
		if (
			pendingBackgroundResume.pathname === normalizePathname(pathname) &&
			performance.now() - pendingBackgroundResume.startedAt <= 60_000
		)
			return 'background_resume'
		pendingBackgroundResume = null
	}
	if (!currentRouteNavigation && documentStart !== null) {
		return 'initial_navigation'
	}
	return 'missing_start'
}

export function measureRouteReadyDuration(
	pathname: string,
	now = performance.now(),
	documentStart = documentNavigationStart(),
	readyKey?: string,
	readyKeyKind: RouteReadyKeyKind = 'identity'
): number | null {
	// Keep keyed starts available while sibling readiness markers consume the
	// same interaction. The owning marker cleanup releases the clock.
	const normalizedPathname = normalizePathname(pathname)
	const pendingResumeStart =
		!currentRouteNavigation &&
		pendingBackgroundResume?.pathname === normalizedPathname
			? pendingBackgroundResume.startedAt
			: undefined
	const start = routeReadyStartTime(
		pathname,
		documentStart,
		readyKey,
		readyKeyKind
	)
	const measured = start === null ? null : Math.max(0, now - start)
	if (pendingResumeStart !== undefined && start === pendingResumeStart) {
		// Identity-keyed readiness markers may use the resume clock as their
		// applicable navigation context. Consume it just like an unkeyed marker;
		// only keyed interaction clocks remain available to sibling markers.
		pendingBackgroundResume = null
	}
	if (
		!readyKey &&
		pendingBackgroundResume?.pathname === normalizedPathname
	) {
		pendingBackgroundResume = null
	}
	return measured
}

export function clearRouteReadyStart(
	pathname: string,
	readyKey?: string
): void {
	if (!readyKey) return
	readyInteractionStarts.delete(
		`${normalizePathname(pathname)}\u0000${readyKey}`
	)
}

export function resetRouteNavigationStartForTests(): void {
	currentRouteNavigation = null
	pendingBackgroundResume = null
	readyInteractionStarts.clear()
}
