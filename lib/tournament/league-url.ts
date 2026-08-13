export const FPL_HOSTNAME = 'fantasy.premierleague.com'

export type LeagueType = 'classic' | 'h2h'
export type LeagueUrlSurface = 'standings' | 'new-entries' | 'admin' | 'join'
export type LeagueUrlErrorCode = 'incomplete' | 'domain' | 'path' | 'id' | 'type'

export class LeagueUrlError extends Error {
	constructor(
		public readonly code: LeagueUrlErrorCode,
		message: string,
	) {
		super(message)
		this.name = 'LeagueUrlError'
	}
}

export interface ParsedLeagueUrl {
	leagueId: number
	leagueType: LeagueType
	surface: LeagueUrlSurface
}

const LOCALE_SEGMENT = /^[a-z]{2}(?:-[a-z]{2})?$/i
const SUPPORTED_SURFACES = new Set<LeagueUrlSurface>([
	'standings',
	'new-entries',
	'admin',
	'join',
])

export function parseLeagueUrl(rawUrl: string): ParsedLeagueUrl {
	let parsedUrl: URL

	try {
		parsedUrl = new URL(rawUrl.trim())
	} catch {
		throw new LeagueUrlError('incomplete', 'Please enter a complete Fantasy Premier League URL.')
	}

	if (
		parsedUrl.protocol !== 'https:' ||
		parsedUrl.hostname !== FPL_HOSTNAME ||
		parsedUrl.port ||
		parsedUrl.username ||
		parsedUrl.password
	) {
		throw new LeagueUrlError('domain', 'Only secure URLs from fantasy.premierleague.com are allowed.')
	}

	const segments = parsedUrl.pathname.split('/').filter(Boolean)
	const hasLocalePrefix = LOCALE_SEGMENT.test(segments[0] ?? '')
	const leaguesIndex = segments[0] === 'leagues'
		? 0
		: hasLocalePrefix && segments[1] === 'leagues'
			? 1
			: -1
	if (leaguesIndex < 0 || segments.length < leaguesIndex + 3) {
		throw new LeagueUrlError('path', 'Unsupported league URL format.')
	}

	const leagueId = Number(segments[leaguesIndex + 1])
	if (!Number.isSafeInteger(leagueId) || leagueId <= 0) {
		throw new LeagueUrlError('id', 'League ID could not be parsed from the URL.')
	}

	const surface = segments[leaguesIndex + 2] as LeagueUrlSurface
	if (!SUPPORTED_SURFACES.has(surface)) {
		throw new LeagueUrlError('path', 'Unsupported league URL format.')
	}

	const suffix = surface === 'standings' || surface === 'new-entries'
		? segments[leaguesIndex + 3]?.toLowerCase()
		: undefined
	if (suffix && !['c', 'classic', 'h', 'h2h'].includes(suffix)) {
		throw new LeagueUrlError('type', 'Unsupported league standings type.')
	}

	return {
		leagueId,
		leagueType: suffix === 'h' || suffix === 'h2h' ? 'h2h' : 'classic',
		surface,
	}
}

export function isSupportedLeagueUrl(value: string): boolean {
	try {
		parseLeagueUrl(value)
		return true
	} catch {
		return false
	}
}
