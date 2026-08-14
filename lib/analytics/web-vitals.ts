import { stripLocaleFromPathname } from '@/i18n/routing'

const WEB_VITAL_NAMES = new Set([
	'CLS',
	'FCP',
	'FID',
	'FIXTURES_WINDOW_READY',
	'LIVE_MATCHDAY_READY',
	'LIVE_MATCH_PLAYERS_READY',
	'LIVE_COMPETITIONS_LIST_READY',
	'LIVE_COMPETITION_BOARD_READY',
	'LIVE_COMPETITION_SWITCH_READY',
	'COMPETITIONS_BROWSE_READY',
	'COMPETITIONS_CREATE_READY',
	'COMPETITIONS_MANAGE_READY',
	'GAMEWEEK_CONTENT_READY',
	'INP',
	'LCP',
	'TTFB',
	'HOME_PERSONAL_HYDRATED',
	'HOME_TEAM_DESK_READY',
	'HOME_LEAGUE_RANKS_READY',
	'MARKET_CONTENT_READY',
	'MARKET_SEARCH_READY',
	'MARKET_HISTORY_READY',
	'MARKET_AVAILABILITY_READY',
	'PLAYER_DIRECTORY_READY',
	'PLAYER_DETAIL_READY',
	'PLAYER_COMPARE_READY',
	'TRENDS_CATALOG_READY',
	'TRENDS_DESK_READY',
	'TRENDS_SWITCH_READY',
	'SESSION_STATE_READY'
])
const WEB_VITAL_RATINGS = new Set(['good', 'needs-improvement', 'poor'])
const DEVICE_GROUPS = new Set(['mobile', 'tablet', 'desktop'])
const AUDIENCE_HINTS = new Set(['public', 'session-hint', 'unknown'])

export type AudienceHint = 'public' | 'session-hint' | 'unknown'

export type WebVitalPayload = {
	name: string
	value: number
	delta: number
	rating: string
	metricId: string
	page: string
	device: string
	audienceHint: AudienceHint
}

const routePatterns: Array<[RegExp, string]> = [
	[/^\/competitions\/browse$/, '/competitions/browse'],
	[/^\/competitions\/create$/, '/competitions/create'],
	[/^\/competitions\/[1-9]\d*\/manage$/, '/competitions/:tournamentId/manage'],
	[/^\/live\/competitions\/[1-9]\d*$/, '/live/competitions/:tournamentId'],
	[/^\/live\/points\/[^/]+$/, '/live/points/:entryId'],
	[/^\/competitions\/[^/]+\/manage$/, '/competitions/:tournamentId/manage'],
	[/^\/competitions\/[^/]+$/, '/competitions/:tournamentId']
]

export const normalizeMetricPage = (pathname: string) => {
	const safePath = pathname.startsWith('/')
		? pathname.split('?')[0].split('#')[0]
		: '/unknown'
	const unlocalizedPath = stripLocaleFromPathname(safePath)
	const normalized = unlocalizedPath.replace(/\/{2,}/g, '/').slice(0, 128)
	return (
		routePatterns.find(([pattern]) => pattern.test(normalized))?.[1] ??
		normalized
	)
}

export const parseWebVitalPayload = (
	input: unknown
): WebVitalPayload | null => {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return null
	const candidate = input as Record<string, unknown>
	const name = typeof candidate.name === 'string' ? candidate.name : ''
	const rating = typeof candidate.rating === 'string' ? candidate.rating : ''
	const metricId =
		typeof candidate.metricId === 'string' ? candidate.metricId : ''
	const page =
		typeof candidate.page === 'string'
			? normalizeMetricPage(candidate.page)
			: ''
	const device = typeof candidate.device === 'string' ? candidate.device : ''
	const audienceHint =
		typeof candidate.audienceHint === 'string'
			? candidate.audienceHint
			: 'unknown'
	const value = candidate.value
	const delta = candidate.delta

	if (!WEB_VITAL_NAMES.has(name) || !WEB_VITAL_RATINGS.has(rating)) return null
	if (
		!DEVICE_GROUPS.has(device) ||
		!AUDIENCE_HINTS.has(audienceHint) ||
		!page ||
		page.length > 128
	)
		return null
	if (!/^[A-Za-z0-9._-]{1,100}$/.test(metricId)) return null
	if (
		typeof value !== 'number' ||
		!Number.isFinite(value) ||
		value < 0 ||
		value > 10_000_000 ||
		typeof delta !== 'number' ||
		!Number.isFinite(delta) ||
		Math.abs(delta) > 10_000_000
	)
		return null

	return {
		name,
		value,
		delta,
		rating,
		metricId,
		page,
		device,
		audienceHint: audienceHint as AudienceHint
	}
}
