const DEFAULT_RETRY_AFTER_SECONDS = 300
const MIN_RETRY_AFTER_SECONDS = 30
const MAX_RETRY_AFTER_SECONDS = 3600

export const MAINTENANCE_MESSAGE =
	'LetLetMe data services are temporarily unavailable during scheduled maintenance.'

type Environment = Readonly<Record<string, string | undefined>>

export interface MaintenanceConfig {
	enabled: boolean
	retryAfterSeconds: number
}

export function readMaintenanceConfig(
	environment: Environment = process.env
): MaintenanceConfig {
	const configuredRetry = Number(environment.MAINTENANCE_RETRY_AFTER_SECONDS)
	const retryAfterSeconds =
		Number.isInteger(configuredRetry) &&
		configuredRetry >= MIN_RETRY_AFTER_SECONDS &&
		configuredRetry <= MAX_RETRY_AFTER_SECONDS
			? configuredRetry
			: DEFAULT_RETRY_AFTER_SECONDS

	return {
		enabled: environment.MAINTENANCE_MODE === 'true',
		retryAfterSeconds
	}
}

export function isMaintenanceDataApi(pathname: string): boolean {
	return (
		pathname === '/api/graphql' ||
		pathname === '/api/agent' ||
		pathname.startsWith('/api/agent/') ||
		pathname === '/api/tournaments' ||
		pathname.startsWith('/api/tournaments/')
	)
}

export function isMaintenanceAgentApi(pathname: string): boolean {
	return pathname === '/api/agent' || pathname.startsWith('/api/agent/')
}

export function agentMaintenanceError(requestId: string) {
	return {
		code: 'UPSTREAM_UNAVAILABLE' as const,
		message: MAINTENANCE_MESSAGE,
		retryable: true,
		requestId
	}
}
