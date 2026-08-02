import { z } from 'zod'
import {
	isSupportedLeagueUrl,
	LeagueUrlError,
	parseLeagueUrl,
	type LeagueType,
} from '@/lib/tournament/league-url'

export type TournamentCreationMode = 'classic' | 'custom'

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

const positiveIntegerString = (message: string) => z.string().trim().regex(/^[1-9]\d*$/, message)

export interface TournamentFormMessages {
	nameTooShort: string
	nameTooLong: string
	validGameweek: string
	validLeagueUrl: string
	gameweekOrder: string
	groupPositive: string
	groupInvalid: string
	qualifierPositive: string
	qualifierInvalid: string
}

const DEFAULT_FORM_MESSAGES: TournamentFormMessages = {
	nameTooShort: 'Tournament name must be at least 3 characters',
	nameTooLong: 'Tournament name must be at most 80 characters',
	validGameweek: 'Select a valid gameweek.',
	validLeagueUrl: 'Enter a valid Fantasy Premier League URL.',
	gameweekOrder: 'End gameweek must be on or after the start gameweek.',
	groupPositive: 'Group number must be a positive whole number.',
	groupInvalid: 'Enter a valid group number.',
	qualifierPositive: 'Qualifiers per group must be a positive whole number.',
	qualifierInvalid: 'Enter a valid qualifier count.',
}

export const createTournamentFormSchema = (messages: TournamentFormMessages = DEFAULT_FORM_MESSAGES) => {
	const gameweekString = z.string().regex(/^GW(?:[1-9]|[12]\d|3[0-8])$/, messages.validGameweek)
	return z.object({
	tournamentName: z.string().trim().min(3, messages.nameTooShort).max(80, messages.nameTooLong),
	participantSource: z.enum(['official', 'custom']),
	leagueUrl: z.string().refine(isSupportedLeagueUrl, {
		message: messages.validLeagueUrl,
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
			message: messages.gameweekOrder,
		})
	}
	if (values.groupFormat === 'points') {
		const result = positiveIntegerString(messages.groupPositive).safeParse(values.groupNum ?? '')
		if (!result.success) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['groupNum'],
				message: result.error.issues[0]?.message ?? messages.groupInvalid,
			})
		}
	}
	if (values.groupFormat === 'points' && values.knockoutFormat !== 'none') {
		const result = positiveIntegerString(messages.qualifierPositive).safeParse(values.qualifiersPerGroup ?? '')
		if (!result.success) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['qualifiersPerGroup'],
				message: result.error.issues[0]?.message ?? messages.qualifierInvalid,
			})
		}
	}
})
}

export const tournamentFormSchema = createTournamentFormSchema()

export type TournamentFormData = z.infer<typeof tournamentFormSchema>

export interface Participant {
	id: string
	team: string
	manager: string
	overallRank: number
	totalPoints: number
}

export type ParticipantApiItem = Participant

export interface LeaguePreview {
	leagueId: number
	leagueName: string
	leagueType: LeagueType
	startEvent: number
}

export interface LeaguePreviewRequestContext {
	requestId: number
	currentRequestId: number
	requestMode: TournamentCreationMode
	currentMode: TournamentCreationMode
	requestedLeagueUrl: string
	currentLeagueUrl: string
}

export function isCurrentLeaguePreviewRequest({
	requestId,
	currentRequestId,
	requestMode,
	currentMode,
	requestedLeagueUrl,
	currentLeagueUrl,
}: LeaguePreviewRequestContext): boolean {
	return requestId === currentRequestId &&
		requestMode === currentMode &&
		requestedLeagueUrl === currentLeagueUrl.trim()
}

export function getImportedTournamentName(leagueName: string, leagueId: number): string {
	const normalized = leagueName.trim()
	const fallback = `FPL League ${leagueId}`
	return (normalized.length >= 3 ? normalized : fallback).slice(0, 80)
}

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

export interface LeagueUrlMessages {
	domainInvalid: string
	pathInvalid: string
	incomplete: string
	classicOnly: string
}

const DEFAULT_LEAGUE_URL_MESSAGES: LeagueUrlMessages = {
	domainInvalid: 'Only secure URLs from fantasy.premierleague.com are allowed.',
	pathInvalid: 'Use a league standings, admin, or join URL.',
	incomplete: 'Enter a complete URL beginning with https://.',
	classicOnly: 'Use an FPL Classic standings URL. Head-to-head import is coming later.',
}

export interface LeagueUrlValidation {
	valid: boolean
	domainValid: boolean
	message: string | null
	leagueId: number | null
	leagueType: LeagueType | null
}

export function validateLeagueUrl(
	value: string,
	messages: LeagueUrlMessages = DEFAULT_LEAGUE_URL_MESSAGES,
	options: { classicOnly?: boolean } = {},
): LeagueUrlValidation {
	if (!value.trim()) {
		return { valid: false, domainValid: true, message: null, leagueId: null, leagueType: null }
	}
	try {
		const parsed = parseLeagueUrl(value)
		if (options.classicOnly && (parsed.leagueType !== 'classic' || parsed.surface !== 'standings')) {
			return {
				valid: false,
				domainValid: true,
				message: messages.classicOnly,
				leagueId: parsed.leagueId,
				leagueType: parsed.leagueType,
			}
		}
		return {
			valid: true,
			domainValid: true,
			message: null,
			leagueId: parsed.leagueId,
			leagueType: parsed.leagueType,
		}
	} catch (error) {
		if (error instanceof LeagueUrlError) {
			if (error.code === 'domain') {
				return { valid: false, domainValid: false, message: messages.domainInvalid, leagueId: null, leagueType: null }
			}
			if (error.code === 'incomplete') {
				return { valid: false, domainValid: false, message: messages.incomplete, leagueId: null, leagueType: null }
			}
		}
		return { valid: false, domainValid: true, message: messages.pathInvalid, leagueId: null, leagueType: null }
	}
}
