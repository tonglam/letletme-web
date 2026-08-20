import { z } from 'zod'

export const LETLETME_TOOL_NAMES = [
	'letletme_context',
	'letletme_players',
	'letletme_gameweek',
	'letletme_market',
	'letletme_entry',
	'letletme_competition',
	'letletme_briefing'
] as const

export type LetLetMeToolName = (typeof LETLETME_TOOL_NAMES)[number]

const toolNameSet = new Set<string>(LETLETME_TOOL_NAMES)

export function isLetLetMeToolName(value: string): value is LetLetMeToolName {
	return toolNameSet.has(value)
}

export type AgentToolErrorCode =
	| 'INVALID_INPUT'
	| 'AUTH_REQUIRED'
	| 'FPL_VERIFICATION_REQUIRED'
	| 'FORBIDDEN'
	| 'NOT_FOUND'
	| 'RATE_LIMITED'
	| 'RESULT_TOO_LARGE'
	| 'UPSTREAM_TIMEOUT'
	| 'UPSTREAM_UNAVAILABLE'

export class AgentToolError extends Error {
	constructor(
		readonly code: AgentToolErrorCode,
		message: string,
		readonly status: number,
		readonly retryable: boolean,
		readonly retryAfterSeconds: number | null = null
	) {
		super(message)
		this.name = 'AgentToolError'
	}
}

export type AgentWarning = { code: string; message: string }

export type AgentToolResponse<T> = {
	schemaVersion: '1'
	tool: LetLetMeToolName
	requestId: string
	asOf: string
	revisions: {
		season?: string
		core?: string
		market?: string
		briefing?: string
	}
	data: T
	page?: { nextCursor: string | null }
	warnings: AgentWarning[]
}

export type AgentSession = {
	user: {
		id: string
		fplEntryId?: number | null
		fplEntryVerifiedAt?: Date | string | null
	}
}

const positiveInt = z.number().int().positive().max(2_147_483_647)
const cursor = z.string().min(1).max(256)
const position = z.enum(['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD'])
const playerSort = z.enum([
	'AUTO',
	'NAME_ASC',
	'TOTAL_POINTS_DESC',
	'FORM_DESC',
	'PRICE_ASC',
	'PRICE_DESC',
	'OWNERSHIP_DESC'
])

const contextInput = z.object({}).strict()

const playersInput = z
	.object({
		playerIds: z.array(positiveInt).min(1).max(100).optional(),
		query: z.string().trim().min(1).max(50).optional(),
		teamId: positiveInt.max(20).optional(),
		position: position.optional(),
		status: z.enum(['a', 'd', 'i', 'n', 's', 'u']).optional(),
		minPrice: z.number().int().min(0).max(5000).optional(),
		maxPrice: z.number().int().min(0).max(5000).optional(),
		ownershipBand: z.enum(['LE5', 'GT5_LE15', 'GT15_LE40', 'GT40']).optional(),
		sort: playerSort.default('AUTO'),
		eventId: positiveInt.max(38).optional(),
		limit: z.number().int().min(1).max(100).default(25),
		cursor: cursor.optional()
	})
	.strict()
	.superRefine((value, context) => {
		if (
			value.minPrice !== undefined &&
			value.maxPrice !== undefined &&
			value.minPrice > value.maxPrice
		) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['minPrice'],
				message: 'minPrice must not exceed maxPrice'
			})
		}
		if (
			value.playerIds &&
			new Set(value.playerIds).size !== value.playerIds.length
		) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['playerIds'],
				message: 'playerIds must not contain duplicates'
			})
		}
	})

const gameweekInput = z
	.object({
		eventId: positiveInt.max(38).optional(),
		horizon: z.number().int().min(1).max(6).default(3),
		playerLimit: z.number().int().min(1).max(100).default(50)
	})
	.strict()

const marketInput = z
	.object({
		days: z.number().int().min(1).max(30).default(7),
		ownershipPeriod: z.enum(['DAILY', 'GAMEWEEK']).default('DAILY'),
		limit: z.number().int().min(1).max(20).default(10)
	})
	.strict()

const entryInput = z
	.object({
		entryId: positiveInt.optional(),
		query: z.string().trim().min(2).max(80).optional(),
		eventId: positiveInt.max(38).optional(),
		limit: z.number().int().min(1).max(20).default(10),
		historyLimit: z.number().int().min(1).max(38).default(8)
	})
	.strict()
	.superRefine((value, context) => {
		if (value.entryId !== undefined && value.query !== undefined) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['query'],
				message: 'entryId and query are mutually exclusive'
			})
		}
		if (value.query !== undefined && value.eventId !== undefined) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['eventId'],
				message: 'eventId is only available for a single entry'
			})
		}
		if (value.entryId !== undefined && value.eventId !== undefined) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['eventId'],
				message: 'eventId is only available for the verified self entry'
			})
		}
	})

const competitionInput = z
	.object({
		competitionId: positiveInt,
		eventId: positiveInt.max(38).optional(),
		limit: z.number().int().min(1).max(50).default(25),
		cursor: cursor.optional()
	})
	.strict()

const briefingInput = z
	.object({
		locale: z.enum(['EN', 'ZH_CN']).default('EN'),
		slug: z.string().trim().min(1).max(160).optional()
	})
	.strict()

export const AGENT_TOOL_INPUT_SCHEMAS = {
	letletme_context: contextInput,
	letletme_players: playersInput,
	letletme_gameweek: gameweekInput,
	letletme_market: marketInput,
	letletme_entry: entryInput,
	letletme_competition: competitionInput,
	letletme_briefing: briefingInput
} satisfies Record<LetLetMeToolName, z.ZodTypeAny>

export type AgentToolInputMap = {
	[K in LetLetMeToolName]: z.infer<(typeof AGENT_TOOL_INPUT_SCHEMAS)[K]>
}

export function parseAgentToolInput<T extends LetLetMeToolName>(
	tool: T,
	input: unknown
): AgentToolInputMap[T] {
	const result = AGENT_TOOL_INPUT_SCHEMAS[tool].safeParse(input)
	if (result.success) return result.data as AgentToolInputMap[T]
	const issue = result.error.issues[0]
	const path = issue?.path.length ? `${issue.path.join('.')}: ` : ''
	throw new AgentToolError(
		'INVALID_INPUT',
		`Invalid input. ${path}${issue?.message ?? 'Request does not match the tool schema.'}`,
		400,
		false
	)
}

export const AGENT_TOOL_CAPABILITIES: ReadonlyArray<{
	name: LetLetMeToolName
	description: string
	access: string
	limits?: Record<string, number>
}> = [
	{
		name: 'letletme_context',
		description: 'Published season, event, revision and coverage context.',
		access: 'authenticated'
	},
	{
		name: 'letletme_players',
		description:
			'Published player directory with bounded filters and cursor pagination.',
		access: 'authenticated',
		limits: { defaultPageSize: 25, maxPageSize: 100 }
	},
	{
		name: 'letletme_gameweek',
		description: 'Published gameweek rules, fixtures and player analysis.',
		access: 'authenticated',
		limits: { maxHorizon: 6, maxPlayers: 100 }
	},
	{
		name: 'letletme_market',
		description:
			'Published lineup, ownership, price and market coverage snapshots.',
		access: 'authenticated'
	},
	{
		name: 'letletme_entry',
		description:
			'Persisted public entry snapshots and verified self-only extensions.',
		access: 'authenticated; verified FPL entry for self extensions'
	},
	{
		name: 'letletme_competition',
		description:
			'Member-authorized competition metadata and paginated results.',
		access: 'verified FPL entry and competition membership',
		limits: { defaultPageSize: 25, maxPageSize: 50 }
	},
	{
		name: 'letletme_briefing',
		description: 'Active or published LetLetMe Briefing content only.',
		access: 'authenticated'
	}
]
