const STORAGE_KEY = 'letletme:dependency-cooldown-until-v1'
const FAILURE_AT_STORAGE_KEY = 'letletme:dependency-cooldown-failure-at-v1'
const DEFAULT_RETRY_AFTER_SECONDS = 30
const MAX_BACKOFF_SECONDS = 120

type DependencyCooldown = {
	active: boolean
	cooldownUntil?: number
	remainingSeconds: number
}

let cooldownUntilMemory = 0
let failureAtMemory = 0
let consecutiveFailures = 0

const isBrowser = (): boolean => typeof window !== 'undefined'

const readStoredUntil = (): number => {
	if (!isBrowser()) return 0
	try {
		const value = Number(window.sessionStorage.getItem(STORAGE_KEY))
		return Number.isFinite(value) && value > 0 ? value : 0
	} catch {
		return 0
	}
}

const writeStoredUntil = (value: number): void => {
	if (!isBrowser()) return
	try {
		if (value > 0) window.sessionStorage.setItem(STORAGE_KEY, String(value))
		else window.sessionStorage.removeItem(STORAGE_KEY)
	} catch {
		// Browser storage is optional; the in-memory fence still prevents a
		// request storm while the current page remains open.
	}
}

const readStoredFailureAt = (): number => {
	if (!isBrowser()) return 0
	try {
		const value = Number(window.sessionStorage.getItem(FAILURE_AT_STORAGE_KEY))
		return Number.isFinite(value) && value > 0 ? value : 0
	} catch {
		return 0
	}
}

const writeStoredFailureAt = (value: number): void => {
	if (!isBrowser()) return
	try {
		if (value > 0)
			window.sessionStorage.setItem(FAILURE_AT_STORAGE_KEY, String(value))
		else window.sessionStorage.removeItem(FAILURE_AT_STORAGE_KEY)
	} catch {
		// Browser storage is optional; the in-memory ordering fence remains
		// sufficient for overlapping requests in the current page.
	}
}

export function parseDependencyRetryAfter(
	value: string | null | undefined,
	now = Date.now()
): number | null {
	const normalized = value?.trim() ?? ''
	if (/^\d+$/.test(normalized)) {
		const seconds = Number(normalized)
		return Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds)) : null
	}
	if (!normalized) return null
	const retryAt = Date.parse(normalized)
	return Number.isFinite(retryAt)
		? Math.max(1, Math.ceil((retryAt - now) / 1_000))
		: null
}

export function readDependencyCooldown(now = Date.now()): DependencyCooldown {
	if (!isBrowser()) return { active: false, remainingSeconds: 0 }
	const storedUntil = readStoredUntil()
	const cooldownUntil = Math.max(cooldownUntilMemory, storedUntil)
	if (!Number.isFinite(cooldownUntil) || cooldownUntil <= now) {
		cooldownUntilMemory = 0
		if (storedUntil > 0) writeStoredUntil(0)
		return { active: false, remainingSeconds: 0 }
	}
	cooldownUntilMemory = cooldownUntil
	if (storedUntil !== cooldownUntil) writeStoredUntil(cooldownUntil)
	return {
		active: true,
		cooldownUntil,
		remainingSeconds: Math.max(1, Math.ceil((cooldownUntil - now) / 1_000))
	}
}

export function noteDependencyFailure(
	retryAfterValue?: string | null,
	now = Date.now()
): DependencyCooldown {
	if (!isBrowser()) return { active: false, remainingSeconds: 0 }
	const parsed = parseDependencyRetryAfter(retryAfterValue, now)
	consecutiveFailures = Math.min(consecutiveFailures + 1, 3)
	const seconds =
		parsed === null
			? Math.min(
					MAX_BACKOFF_SECONDS,
					DEFAULT_RETRY_AFTER_SECONDS * 2 ** (consecutiveFailures - 1)
				)
			: parsed
	const requestedUntil = now + seconds * 1_000
	const storedUntil = readStoredUntil()
	const storedFailureAt = readStoredFailureAt()
	failureAtMemory = Math.max(failureAtMemory, storedFailureAt, now)
	cooldownUntilMemory = Math.max(
		cooldownUntilMemory,
		storedUntil,
		requestedUntil
	)
	writeStoredUntil(cooldownUntilMemory)
	writeStoredFailureAt(failureAtMemory)
	return readDependencyCooldown(now)
}

/**
 * Clear only failures observed before the successful request began. A request
 * that started while another request was in flight can finish after the newer
 * request records a dependency failure; it must not erase that newer fence.
 */
export function clearDependencyCooldown(successStartedAt = Date.now()): void {
	if (!isBrowser()) return
	const lastFailureAt = Math.max(failureAtMemory, readStoredFailureAt())
	if (lastFailureAt > successStartedAt) return
	cooldownUntilMemory = 0
	failureAtMemory = 0
	consecutiveFailures = 0
	writeStoredUntil(0)
	writeStoredFailureAt(0)
}

export function dependencyCooldownErrorDetails(
	now = Date.now()
): { retryAfterSeconds: number; cooldownUntil: number } | null {
	const state = readDependencyCooldown(now)
	return state.active && state.cooldownUntil
		? {
				retryAfterSeconds: state.remainingSeconds,
				cooldownUntil: state.cooldownUntil
			}
		: null
}
