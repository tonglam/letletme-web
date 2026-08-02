import { z } from 'zod'

export const PARTICIPANT_SOURCES = [
	{ value: 'official', label: 'Official' },
	{ value: 'custom', label: 'Custom' },
] as const

export const GROUP_FORMATS = [
	{ value: 'none', label: 'No Group' },
	{ value: 'points', label: 'Points Race' },
] as const

export const KNOCKOUT_FORMATS = [
	{ value: 'none', label: 'No Knockout' },
	{ value: 'single', label: 'Single Elimination' },
	{ value: 'double', label: 'Double Elimination' },
] as const

export const GAMEWEEKS = Array.from({ length: 38 }, (_, index) => ({
	value: `GW${index + 1}`,
	label: `Gameweek ${index + 1}`,
}))

export const FPL_LEAGUE_URL_PATTERN =
	/^https:\/\/fantasy\.premierleague\.com\/leagues\/\d+\/(standings|admin|join)(?:[/?#].*)?$/

const positiveIntegerString = (message: string) => z.string().trim().regex(/^[1-9]\d*$/, message)
const gameweekString = z.string().regex(/^GW(?:[1-9]|[12]\d|3[0-8])$/, 'Select a valid gameweek.')

export const tournamentFormSchema = z.object({
	tournamentName: z.string().trim().min(3, 'Tournament name must be at least 3 characters').max(80, 'Tournament name must be at most 80 characters'),
	participantSource: z.enum(['official', 'custom']),
	leagueUrl: z.string().refine((value) => FPL_LEAGUE_URL_PATTERN.test(value), {
		message: 'Enter a valid Fantasy Premier League URL.',
	}),
	groupFormat: z.enum(['none', 'points']),
	startGameweek: gameweekString,
	endGameweek: gameweekString,
	groupNum: z.string().optional(),
	qualifiersPerGroup: z.string().optional(),
	knockoutFormat: z.enum(['none', 'single', 'double']),
}).superRefine((values, context) => {
	if (parseGameweek(values.endGameweek) < parseGameweek(values.startGameweek)) {
		context.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['endGameweek'],
			message: 'End gameweek must be on or after the start gameweek.',
		})
	}
	if (values.groupFormat === 'points') {
		const result = positiveIntegerString('Group number must be a positive whole number.').safeParse(values.groupNum ?? '')
		if (!result.success) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['groupNum'],
				message: result.error.issues[0]?.message ?? 'Enter a valid group number.',
			})
		}
	}
	if (values.groupFormat === 'points' && values.knockoutFormat !== 'none') {
		const result = positiveIntegerString('Qualifiers per group must be a positive whole number.').safeParse(values.qualifiersPerGroup ?? '')
		if (!result.success) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['qualifiersPerGroup'],
				message: result.error.issues[0]?.message ?? 'Enter a valid qualifier count.',
			})
		}
	}
})

export type TournamentFormData = z.infer<typeof tournamentFormSchema>

export interface Participant {
	id: string
	team: string
	manager: string
	overallRank: number
	totalPoints: number
}

export type ParticipantApiItem = Participant

export interface TournamentPlan {
	totalEntries: number
	groupStart: number
	groupEnd: number
	groupRounds: number
	groupCount: number
	qualifiersPerGroup: number
	groupTeamCount: number
	groupReady: boolean
	qualifyTotalExceedsEntries: boolean
	knockoutPlayAgainstCount: number
	knockoutTeamCount: number
	knockoutEventCount: number
	knockoutRounds: number
	knockoutStart: number
	knockoutEnd: number
	knockoutTeamCountIsPowerOfTwo: boolean
	knockoutReady: boolean
}

export const DEFAULT_TOURNAMENT_FORM: TournamentFormData = {
	tournamentName: '',
	participantSource: 'official',
	leagueUrl: '',
	groupFormat: 'points',
	startGameweek: 'GW1',
	endGameweek: 'GW38',
	groupNum: '1',
	qualifiersPerGroup: '',
	knockoutFormat: 'none',
}

export function parseGameweek(value?: string): number {
	const parsed = Number(value?.replace('GW', ''))
	return Number.isInteger(parsed) ? parsed : 0
}

export function isPowerOfTwo(value: number): boolean {
	return value >= 2 && (value & (value - 1)) === 0
}

export function computeTournamentPlan(
	values: Pick<TournamentFormData, 'groupFormat' | 'startGameweek' | 'endGameweek' | 'groupNum' | 'qualifiersPerGroup' | 'knockoutFormat'>,
	totalEntries: number,
	participantsLoaded: boolean,
): TournamentPlan {
	const groupStart = parseGameweek(values.startGameweek)
	const groupEnd = parseGameweek(values.endGameweek)
	const groupRounds = Math.max(groupEnd - groupStart + 1, 0)
	const groupCount = Math.max(Number(values.groupNum || '1') || 1, 1)
	const qualifiersPerGroup = Math.max(Number(values.qualifiersPerGroup || '0') || 0, 0)
	const groupTeamCount = values.groupFormat === 'points' ? Math.ceil(totalEntries / groupCount) : totalEntries
	const qualifyTotalExceedsEntries =
		values.groupFormat === 'points' &&
		values.knockoutFormat !== 'none' &&
		groupCount * qualifiersPerGroup > totalEntries
	const groupReady =
		participantsLoaded &&
		totalEntries >= 2 &&
		groupStart > 0 &&
		groupEnd >= groupStart &&
		(values.groupFormat === 'none' || groupCount >= 1)

	const knockoutPlayAgainstCount = values.knockoutFormat === 'single' ? 1 : values.knockoutFormat === 'double' ? 2 : 0
	const knockoutTeamCount = values.knockoutFormat === 'none'
		? 0
		: values.groupFormat === 'points'
			? groupCount * qualifiersPerGroup
			: totalEntries
	const knockoutTeamCountIsPowerOfTwo = values.knockoutFormat === 'none' || isPowerOfTwo(knockoutTeamCount)
	const knockoutEventCount = knockoutTeamCount >= 2 ? Math.ceil(Math.log2(knockoutTeamCount)) : 0
	const knockoutRounds = values.knockoutFormat === 'double' ? knockoutEventCount * 2 : knockoutEventCount
	const knockoutStart = groupEnd > 0 ? groupEnd + 1 : 0
	const knockoutEnd = knockoutStart > 0 ? knockoutStart + Math.max(knockoutRounds - 1, 0) : 0
	const knockoutReady = groupReady && (
		values.knockoutFormat === 'none' ||
		((values.groupFormat === 'none' || qualifiersPerGroup >= 1) &&
			!qualifyTotalExceedsEntries &&
			knockoutTeamCount >= 2 &&
			knockoutTeamCountIsPowerOfTwo &&
			knockoutStart > 0 &&
			knockoutEnd <= 38)
	)

	return {
		totalEntries,
		groupStart,
		groupEnd,
		groupRounds,
		groupCount,
		qualifiersPerGroup,
		groupTeamCount,
		groupReady,
		qualifyTotalExceedsEntries,
		knockoutPlayAgainstCount,
		knockoutTeamCount,
		knockoutEventCount,
		knockoutRounds,
		knockoutStart,
		knockoutEnd,
		knockoutTeamCountIsPowerOfTwo,
		knockoutReady,
	}
}

export function validateLeagueUrl(value: string): { valid: boolean; domainValid: boolean; message: string | null } {
	if (!value) return { valid: false, domainValid: true, message: null }
	try {
		const url = new URL(value)
		if (url.protocol !== 'https:' || url.hostname !== 'fantasy.premierleague.com') {
			return { valid: false, domainValid: false, message: 'Only secure URLs from fantasy.premierleague.com are allowed.' }
		}
		if (!FPL_LEAGUE_URL_PATTERN.test(value)) {
			return { valid: false, domainValid: true, message: 'Use a league standings, admin, or join URL.' }
		}
		return { valid: true, domainValid: true, message: null }
	} catch {
		return { valid: false, domainValid: false, message: 'Enter a complete URL beginning with https://.' }
	}
}
