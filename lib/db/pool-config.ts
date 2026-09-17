export const WEB_DATABASE_POOL_MAX = 2
export const WEB_DATABASE_STATEMENT_TIMEOUT_MS = 5_000
export const WEB_DATABASE_LOCK_TIMEOUT_MS = 5_000
export const WEB_DATABASE_IDLE_TRANSACTION_TIMEOUT_MS = 5_000

export function resolveWebDatabasePoolMax(
	value = process.env.DATABASE_POOL_MAX
): number {
	if (value === undefined || value.trim() === '') return WEB_DATABASE_POOL_MAX
	const normalized = value.trim()
	if (!/^[12]$/.test(normalized)) {
		throw new Error('DATABASE_POOL_MAX must be an integer from 1 through 2')
	}
	return Number(normalized)
}
