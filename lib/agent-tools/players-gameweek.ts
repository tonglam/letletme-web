import type { AgentToolInputMap, AgentWarning } from '@/lib/agent-tools/contracts'
import {
	GAMEWEEK_DOCUMENT,
	PLAYER_CATALOG_DOCUMENT,
	PLAYERS_DOCUMENT
} from '@/lib/agent-tools/documents'
import {
	coreEventId,
	decodeCursor,
	encodeCursor,
	executeDocument,
	fingerprint,
	loadCoreContext,
	type CoreContext,
	type MarketContext,
	toolResponse,
	type ToolRunOptions
} from '@/lib/agent-tools/runtime'

type ToolPlayer = {
	id: number
	webName: string
	team: { id: number; name: string; shortName: string }
	position: string
	price: number
	selectedByPercent?: number | null
	ownership?: number | null
	totalPoints: number | null
	form: number | null
	status?: string | null
	news?: string | null
	chanceOfPlaying?: number | null
}

type PlayersPageResult = {
	coreEventContext: CoreContext
	marketSnapshotContext: MarketContext
	playersForPicker: {
		totalCount: number
		nextCursor: number | null
		items: ToolPlayer[]
	}
}

const playerFilterKey = (
	input: AgentToolInputMap['letletme_players'],
	eventId?: number
): string =>
	fingerprint({
		playerIds: input.playerIds ?? null,
		query: input.query ?? null,
		teamId: input.teamId ?? null,
		position: input.position ?? null,
		status: input.status ?? null,
		minPrice: input.minPrice ?? null,
		maxPrice: input.maxPrice ?? null,
		ownershipBand: input.ownershipBand ?? null,
		sort: input.sort,
		eventId: eventId ?? null
	})

const loadPlayersPage = (
	options: ToolRunOptions<'letletme_players'>,
	limit: number,
	cursor: number | null
): Promise<PlayersPageResult> =>
	executeDocument<PlayersPageResult>(options, PLAYERS_DOCUMENT, {
		search: options.input.query,
		filter: {
			teamId: options.input.teamId,
			position: options.input.position,
			minPrice: options.input.minPrice,
			maxPrice: options.input.maxPrice
		},
		sort: options.input.sort,
		ownershipBand: options.input.ownershipBand,
		limit,
		cursor
	})

const sortCatalogPlayers = (
	players: ToolPlayer[],
	sort: AgentToolInputMap['letletme_players']['sort']
): ToolPlayer[] =>
	players.sort((left, right) => {
		if (sort === 'NAME_ASC') return left.webName.localeCompare(right.webName) || left.id - right.id
		if (sort === 'PRICE_ASC') return left.price - right.price || left.id - right.id
		if (sort === 'PRICE_DESC') return right.price - left.price || left.id - right.id
		if (sort === 'FORM_DESC') {
			return (right.form ?? -Infinity) - (left.form ?? -Infinity) || left.id - right.id
		}
		if (sort === 'OWNERSHIP_DESC') {
			return (right.ownership ?? -Infinity) - (left.ownership ?? -Infinity) || left.id - right.id
		}
		return (right.totalPoints ?? -Infinity) - (left.totalPoints ?? -Infinity) || left.id - right.id
	})

export async function runPlayers(options: ToolRunOptions<'letletme_players'>) {
	const input = options.input
	const catalogMode = Boolean(input.playerIds || input.status)
	if (!catalogMode) {
		const key = playerFilterKey(input)
		const upstreamCursor = decodeCursor(input.cursor, {
			kind: 'players',
			mode: 'picker',
			key
		})
		const first = await loadPlayersPage(options, Math.min(input.limit, 50), upstreamCursor)
		let finalPage = first.playersForPicker
		let items = [...finalPage.items]
		const warnings: AgentWarning[] = []
		if (input.limit > 50 && finalPage.nextCursor !== null) {
			const second = await loadPlayersPage(options, input.limit - 50, finalPage.nextCursor)
			if (
				second.coreEventContext.revision === first.coreEventContext.revision &&
				second.marketSnapshotContext.revision === first.marketSnapshotContext.revision
			) {
				items = items.concat(second.playersForPicker.items)
				finalPage = second.playersForPicker
			} else {
				warnings.push({
					code: 'REVISION_MISMATCH',
					message: 'The publication changed while loading this page; only one pinned revision is returned.'
				})
			}
		}
		const { coreEventContext: core, marketSnapshotContext: market } = first
		const nextCursor =
			finalPage.nextCursor === null
				? null
				: encodeCursor({ kind: 'players', mode: 'picker', key, value: finalPage.nextCursor })
		return toolResponse(
			options,
			{
				mode: 'published-picker',
				totalCount: first.playersForPicker.totalCount,
				items: items.map(item => ({ ...item, status: null }))
			},
			{ season: core.season, core: core.revision, market: market.revision },
			warnings,
			{ nextCursor },
			market.capturedAt ?? core.sourceCheckedAt
		)
	}

	const eventId = input.eventId ?? coreEventId(await loadCoreContext(options))
	const key = playerFilterKey(input, eventId)
	const result = await executeDocument<{
		teamSelectionDesk: {
			season: string
			coreRevision: string
			marketRevision: string | null
			checkedAt: string
			eventId: number
			playerPool: { state: string; checkedAt: string | null; message: string | null }
			players: ToolPlayer[]
		}
	}>(options, PLAYER_CATALOG_DOCUMENT, { eventId })
	const desk = result.teamSelectionDesk
	const ids = input.playerIds ? new Set(input.playerIds) : null
	const query = input.query?.toLocaleLowerCase('en-US')
	const filtered = sortCatalogPlayers(
		desk.players
			.filter(player => !ids || ids.has(player.id))
			.filter(player => !query || player.webName.toLocaleLowerCase('en-US').includes(query))
			.filter(player => input.teamId === undefined || player.team.id === input.teamId)
			.filter(player => input.position === undefined || player.position === input.position)
			.filter(player => input.status === undefined || player.status === input.status)
			.filter(player => input.minPrice === undefined || player.price >= input.minPrice)
			.filter(player => input.maxPrice === undefined || player.price <= input.maxPrice)
			.filter(player => {
				if (!input.ownershipBand) return true
				const ownership = player.ownership
				if (ownership === null || ownership === undefined) return false
				if (input.ownershipBand === 'LE5') return ownership <= 5
				if (input.ownershipBand === 'GT5_LE15') return ownership > 5 && ownership <= 15
				if (input.ownershipBand === 'GT15_LE40') return ownership > 15 && ownership <= 40
				return ownership > 40
			}),
		input.sort
	)
	const offset = decodeCursor(input.cursor, { kind: 'players', mode: 'catalog', key }) ?? 0
	const items = filtered.slice(offset, offset + input.limit)
	const nextOffset = offset + items.length
	const nextCursor =
		nextOffset < filtered.length
			? encodeCursor({ kind: 'players', mode: 'catalog', key, value: nextOffset })
			: null
	const warnings: AgentWarning[] = []
	if (desk.playerPool.state !== 'READY') {
		warnings.push({
			code: `PLAYER_COVERAGE_${desk.playerPool.state}`,
			message: desk.playerPool.message ?? 'Published player coverage is not complete.'
		})
	}
	return toolResponse(
		options,
		{ mode: 'published-catalog', eventId: desk.eventId, totalCount: filtered.length, items },
		{
			season: desk.season,
			core: desk.coreRevision,
			...(desk.marketRevision ? { market: desk.marketRevision } : {})
		},
		warnings,
		{ nextCursor },
		desk.checkedAt
	)
}

export async function runGameweek(options: ToolRunOptions<'letletme_gameweek'>) {
	const eventId = options.input.eventId ?? coreEventId(await loadCoreContext(options))
	const result = await executeDocument<{
		teamSelectionDesk: {
			season: string
			coreRevision: string
			marketRevision: string | null
			checkedAt: string
			deadline: string | null
			phase: string
			eventId: number
			horizon: number
			rules: unknown
			players: ToolPlayer[]
			fixtures: unknown[]
			playerPool: { state: string; checkedAt: string | null; message: string | null }
			fixtureSection: { state: string; checkedAt: string | null; message: string | null }
			rulesSection: { state: string; checkedAt: string | null; message: string | null }
		}
	}>(options, GAMEWEEK_DOCUMENT, { eventId, horizon: options.input.horizon })
	const desk = result.teamSelectionDesk
	const coverage = {
		players: desk.playerPool,
		fixtures: desk.fixtureSection,
		rules: desk.rulesSection
	}
	const warnings = Object.entries(coverage)
		.filter(([, section]) => section.state !== 'READY')
		.map(([name, section]) => ({
			code: `${name.toUpperCase()}_COVERAGE_${section.state}`,
			message: section.message ?? `${name} coverage is not ready.`
		}))
	return toolResponse(
		options,
		{
			eventId: desk.eventId,
			horizon: desk.horizon,
			deadline: desk.deadline,
			phase: desk.phase,
			rules: desk.rules,
			fixtures: desk.fixtures,
			players: desk.players.slice(0, options.input.playerLimit),
			playerCount: desk.players.length,
			coverage
		},
		{
			season: desk.season,
			core: desk.coreRevision,
			...(desk.marketRevision ? { market: desk.marketRevision } : {})
		},
		warnings,
		undefined,
		desk.checkedAt
	)
}
