import { PublicError } from '@/lib/safe-errors'
import { parseLeagueUrl } from './league-url'

export class InvalidTournamentPayloadError extends PublicError {
	constructor(message = 'Invalid tournament payload.') {
		super(message, 'InvalidTournamentPayloadError')
	}
}

export function buildAuthoritativeTournamentPayload(
	body: unknown,
	user: {
		fplEntryId: number
		name?: string | null
		platformAdmin?: boolean | null
	}
): Record<string, unknown> {
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		throw new InvalidTournamentPayloadError()
	}
	if (!Number.isSafeInteger(user.fplEntryId) || user.fplEntryId <= 0) {
		throw new InvalidTournamentPayloadError('A verified FPL entry is required.')
	}

	const creator = user.name?.trim() || `FPL ${user.fplEntryId}`
	const record = body as Record<string, unknown>
	const { creationMode, ...browserPayload } = record

	if (
		creationMode !== undefined &&
		creationMode !== 'classic' &&
		creationMode !== 'h2h' &&
		creationMode !== 'custom'
	) {
		throw new InvalidTournamentPayloadError(
			'Unsupported tournament creation mode.'
		)
	}

	if (creationMode === 'classic' || creationMode === 'h2h') {
		const isH2H = creationMode === 'h2h'
		if (typeof browserPayload.leagueUrl !== 'string') {
			throw new InvalidTournamentPayloadError(
				isH2H
					? 'A head-to-head league URL is required.'
					: 'A classic league URL is required.'
			)
		}
		let parsedLeague
		try {
			parsedLeague = parseLeagueUrl(browserPayload.leagueUrl)
		} catch {
			throw new InvalidTournamentPayloadError(
				isH2H
					? 'A valid head-to-head league URL is required.'
					: 'A valid classic league URL is required.'
			)
		}
		const validSurface = isH2H
			? parsedLeague.surface === 'standings' ||
				parsedLeague.surface === 'new-entries'
			: parsedLeague.surface === 'standings'
		if (parsedLeague.leagueType !== creationMode || !validSurface) {
			throw new InvalidTournamentPayloadError(
				isH2H
					? 'Use an FPL Head-to-Head standings or new entries URL.'
					: 'Use an FPL Classic standings URL.'
			)
		}
		if (
			typeof browserPayload.tournamentName !== 'string' ||
			browserPayload.tournamentName.trim().length < 3 ||
			browserPayload.tournamentName.trim().length > 80
		) {
			throw new InvalidTournamentPayloadError(
				'Tournament name must be between 3 and 80 characters.'
			)
		}
		if (
			browserPayload.previewToken !== undefined &&
			(typeof browserPayload.previewToken !== 'string' ||
				!/^[A-Za-z0-9_-]{32,128}$/.test(browserPayload.previewToken))
		) {
			throw new InvalidTournamentPayloadError(
				'Preview the league before creating the tournament.'
			)
		}
		const startGameweek =
			typeof browserPayload.startGameweek === 'string' &&
			/^GW(?:[1-9]|[12]\d|3[0-8])$/.test(browserPayload.startGameweek)
				? browserPayload.startGameweek
				: 'GW1'

		return {
			tournamentName: browserPayload.tournamentName.trim(),
			participantSource: 'official',
			tournamentType: 'standard',
			leagueUrl: browserPayload.leagueUrl.trim(),
			groupFormat: 'points',
			startGameweek,
			endGameweek: 'GW38',
			groupNum: '1',
			qualifiersPerGroup: '',
			knockoutFormat: 'none',
			adminId: String(user.fplEntryId),
			creator,
			platformAdmin: user.platformAdmin === true,
			...(typeof browserPayload.previewToken === 'string'
				? { previewToken: browserPayload.previewToken }
				: {})
		}
	}

	if (
		browserPayload.previewToken !== undefined &&
		(typeof browserPayload.previewToken !== 'string' ||
			!/^[A-Za-z0-9_-]{32,128}$/.test(browserPayload.previewToken))
	) {
		throw new InvalidTournamentPayloadError(
			'Preview the league before creating the tournament.'
		)
	}
	return {
		...browserPayload,
		// Identity is server-owned. Browser values with the same names are always
		// overwritten before the command crosses the trust boundary.
		adminId: String(user.fplEntryId),
		creator,
		platformAdmin: user.platformAdmin === true
	}
}
