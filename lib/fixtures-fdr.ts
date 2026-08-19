import type {
	FixturePlanningMarketSignals,
	FixtureSignalPlayer
} from '@/lib/graphql/operations/market'

export type FdrHorizon = 3 | 5 | 8

export const DEFAULT_FDR_HORIZON: FdrHorizon = 5
export const FDR_HORIZONS: FdrHorizon[] = [3, 5, 8]

/** Easy fixture cells (FPL: 1–2). */
export const FDR_EASY_MAX = 2
/** Hard fixture cells (FPL: 4–5). */
export const FDR_HARD_MIN = 4

/** Top N easiest / hardest teams for action buckets. */
export const FDR_TEAM_TIER_SIZE = 6

export const FDR_ACTION_THRESHOLDS = {
	/** Popular favourable ownership floor. */
	highOwnedPercent: 15,
	/** Differential favourable ceiling (exclusive). */
	diffOwnedMaxPercent: 15,
	/** Popular difficult ownership floor. */
	trapOwnedPercent: 20,
	/** Premium price in tenths (£8.0m = 80). */
	premiumPriceTenths: 80
} as const

export type TeamFixtureCell = {
	fixtureId: number
	eventId: number
	opponentShortName: string
	wasHome: boolean
	/** 1 easy … 5 hard for this team */
	difficulty: number
	finished: boolean
}

export type TeamFixtureGameweek = {
	eventId: number
	fixtures: TeamFixtureCell[]
	bgw: boolean
	dgw: boolean
	/** The event was requested but its fixture response was unavailable. */
	unknown?: boolean
	/** Average for the actual fixtures in this gameweek. Null for a BGW. */
	averageFdr: number | null
}

export type FdrTeamIdentity = {
	id: number
	name: string
	shortName: string
}

export type FdrPlanningFixture = {
	id: number
	finished: boolean
	homeTeam: FdrTeamIdentity
	awayTeam: FdrTeamIdentity
	homeTeamDifficulty: number
	awayTeamDifficulty: number
}

export type TeamFdrRow = {
	teamId: number
	teamName: string
	teamShortName: string
	/** Average FDR over window (lower = easier) */
	avgFdr: number | null
	easyCount: number
	hardCount: number
	nextFdr: number | null
	fixtureCount: number
	blankCount: number
	doubleCount: number
	unknownCount: number
	gameweeks: TeamFixtureGameweek[]
	/** Flattened presentation view that keeps every DGW fixture. */
	run: TeamFixtureCell[]
}

export type FdrPlayerSignal = {
	playerId: number
	webName: string
	teamId: number
	teamShortName: string
	position: string
	price: number
	selectedByPercent: number
	source: 'most-selected' | 'riser' | 'faller' | 'transfer'
}

export type FdrReviewCandidate = FdrPlayerSignal & {
	avgFdr: number | null
	nextOpponent: string | null
	nextHome: boolean | null
	nextFdr: number | null
	teamShortNameResolved: string
}

export type FdrReviewBuckets = {
	/** Favourable team run + ownership >= 15%. */
	popularFavourable: FdrReviewCandidate[]
	/** Favourable team run + ownership < 15%. */
	differentialFavourable: FdrReviewCandidate[]
	/** Difficult team run + ownership >= 20% or price >= £8.0m. */
	popularDifficult: FdrReviewCandidate[]
}

export type FdrDeskModel = {
	fromGw: number
	horizon: FdrHorizon
	teams: TeamFdrRow[]
	/** easiest first */
	easiest: TeamFdrRow[]
	/** hardest first */
	hardest: TeamFdrRow[]
	candidates: FdrReviewBuckets
}

function clampDifficulty(value: number): number {
	if (!Number.isFinite(value)) return 3
	return Math.min(5, Math.max(1, Math.round(value)))
}

/** Collect every per-team fixture in an exact gameweek window. */
export function buildTeamFdrRows(
	fixturesByEvent: Map<number, FdrPlanningFixture[]>,
	fromGw: number,
	horizon: number,
	knownTeams: FdrTeamIdentity[] = [],
	unknownEvents: ReadonlySet<number> = new Set()
): TeamFdrRow[] {
	const eventIds = Array.from({ length: horizon }, (_, i) => fromGw + i).filter(
		id => id >= 1 && id <= 38
	)

	type Acc = {
		teamId: number
		teamName: string
		teamShortName: string
		cellsByEvent: Map<number, TeamFixtureCell[]>
	}
	const byTeam = new Map<number, Acc>()

	const ensure = (
		teamId: number,
		teamName: string,
		teamShortName: string
	): Acc => {
		let row = byTeam.get(teamId)
		if (!row) {
			row = { teamId, teamName, teamShortName, cellsByEvent: new Map() }
			byTeam.set(teamId, row)
		}
		return row
	}

	for (const team of knownTeams) {
		if (team.id > 0) ensure(team.id, team.name, team.shortName)
	}

	const addCell = (acc: Acc, cell: TeamFixtureCell) => {
		const list = acc.cellsByEvent.get(cell.eventId) ?? []
		list.push(cell)
		acc.cellsByEvent.set(cell.eventId, list)
	}

	for (const eventId of eventIds) {
		const fixtures = fixturesByEvent.get(eventId) ?? []
		for (const f of fixtures) {
			const home = f.homeTeam
			const away = f.awayTeam
			if (!home?.id || !away?.id) continue

			const homeAcc = ensure(home.id, home.name, home.shortName)
			addCell(homeAcc, {
				fixtureId: f.id,
				eventId,
				opponentShortName: away.shortName,
				wasHome: true,
				difficulty: clampDifficulty(f.homeTeamDifficulty),
				finished: f.finished
			})

			const awayAcc = ensure(away.id, away.name, away.shortName)
			addCell(awayAcc, {
				fixtureId: f.id,
				eventId,
				opponentShortName: home.shortName,
				wasHome: false,
				difficulty: clampDifficulty(f.awayTeamDifficulty),
				finished: f.finished
			})
		}
	}

	const rows: TeamFdrRow[] = []
	for (const acc of Array.from(byTeam.values())) {
		const gameweeks = eventIds.map(eventId => {
			const fixtures = [...(acc.cellsByEvent.get(eventId) ?? [])].sort(
				(a, b) => a.fixtureId - b.fixtureId
			)
			return {
				eventId,
				fixtures,
				bgw: fixtures.length === 0 && !unknownEvents.has(eventId),
				dgw: fixtures.length > 1,
				unknown: unknownEvents.has(eventId),
				averageFdr:
					fixtures.length > 0
						? fixtures.reduce((sum, cell) => sum + cell.difficulty, 0) /
							fixtures.length
						: null
			} satisfies TeamFixtureGameweek
		})
		const run = gameweeks.flatMap(gameweek => gameweek.fixtures)
		const sum = run.reduce((total, cell) => total + cell.difficulty, 0)
		const avgFdr = run.length > 0 ? sum / run.length : null
		const easyCount = run.filter(c => c.difficulty <= FDR_EASY_MAX).length
		const hardCount = run.filter(c => c.difficulty >= FDR_HARD_MIN).length
		const next = run[0] ?? null

		rows.push({
			teamId: acc.teamId,
			teamName: acc.teamName,
			teamShortName: acc.teamShortName,
			avgFdr,
			easyCount,
			hardCount,
			nextFdr: next?.difficulty ?? null,
			fixtureCount: run.length,
			blankCount: gameweeks.filter(gameweek => gameweek.bgw).length,
			doubleCount: gameweeks.filter(gameweek => gameweek.dgw).length,
			unknownCount: gameweeks.filter(gameweek => gameweek.unknown).length,
			gameweeks,
			run
		})
	}

	return rows.sort((a, b) => {
		if (a.avgFdr == null && b.avgFdr != null) return 1
		if (a.avgFdr != null && b.avgFdr == null) return -1
		if (a.avgFdr != null && b.avgFdr != null && a.avgFdr !== b.avgFdr) {
			return a.avgFdr - b.avgFdr
		}
		return a.teamShortName.localeCompare(b.teamShortName)
	})
}

export function collectMarketSignals(
	pulse: FixturePlanningMarketSignals | null
): FdrPlayerSignal[] {
	if (!pulse) return []
	const map = new Map<number, FdrPlayerSignal>()

	const add = (
		player: FixtureSignalPlayer,
		source: FdrPlayerSignal['source']
	) => {
		const existing = map.get(player.playerId)
		if (existing) {
			// Prefer most-selected label; keep higher ownership snapshot
			if (
				player.selectedByPercent > existing.selectedByPercent ||
				(source === 'most-selected' && existing.source !== 'most-selected')
			) {
				map.set(player.playerId, {
					playerId: player.playerId,
					webName: player.webName,
					teamId: player.teamId,
					teamShortName: player.teamShortName,
					position: player.position,
					price: player.price,
					selectedByPercent: player.selectedByPercent,
					source:
						source === 'most-selected' || existing.source === 'most-selected'
							? 'most-selected'
							: source
				})
			}
			return
		}
		map.set(player.playerId, {
			playerId: player.playerId,
			webName: player.webName,
			teamId: player.teamId,
			teamShortName: player.teamShortName,
			position: player.position,
			price: player.price,
			selectedByPercent: player.selectedByPercent,
			source
		})
	}

	for (const p of pulse.mostSelected ?? []) add(p, 'most-selected')
	const gameweekOwnership = pulse.gameweekOwnership
	const rollingOwnership = pulse.rollingOwnership
	const ownership =
		gameweekOwnership &&
		(gameweekOwnership.coverage.status === 'READY' ||
			gameweekOwnership.coverage.status === 'PARTIAL') &&
		(gameweekOwnership.risers.length > 0 ||
			gameweekOwnership.fallers.length > 0)
			? gameweekOwnership
			: rollingOwnership
	for (const m of ownership?.risers ?? []) add(m.player, 'riser')
	for (const m of ownership?.fallers ?? []) add(m.player, 'faller')
	for (const m of pulse.transferMovers ?? []) add(m.player, 'transfer')

	return Array.from(map.values())
}

function enrichPlayer(
	signal: FdrPlayerSignal,
	teamById: Map<number, TeamFdrRow>
): FdrReviewCandidate | null {
	const team = teamById.get(signal.teamId)
	if (!team) return null
	const next = team.run[0] ?? null
	return {
		...signal,
		avgFdr: team.avgFdr,
		nextOpponent: next?.opponentShortName ?? null,
		nextHome: next?.wasHome ?? null,
		nextFdr: next?.difficulty ?? null,
		teamShortNameResolved: team.teamShortName
	}
}

function rankableTeams(teams: TeamFdrRow[]): TeamFdrRow[] {
	return teams.filter(
		team =>
			team.blankCount === 0 && team.unknownCount === 0 && team.avgFdr != null
	)
}

/**
 * Deterministic, mutually exclusive fixture-review groups. These describe
 * official FDR plus current market visibility; they are not transfer advice.
 */
export function buildFdrReviewBuckets(
	teams: TeamFdrRow[],
	signals: FdrPlayerSignal[]
): FdrReviewBuckets {
	const eligibleTeams = rankableTeams(teams)
	const tierSize = Math.min(
		FDR_TEAM_TIER_SIZE,
		Math.max(1, Math.floor(eligibleTeams.length / 2))
	)
	const easiestIds = new Set(
		[...eligibleTeams]
			.sort((a, b) => (a.avgFdr ?? 99) - (b.avgFdr ?? 99))
			.slice(0, tierSize)
			.map(t => t.teamId)
	)
	const hardestIds = new Set(
		[...eligibleTeams]
			.sort((a, b) => (b.avgFdr ?? -1) - (a.avgFdr ?? -1))
			.slice(0, tierSize)
			.map(t => t.teamId)
	)
	for (const teamId of Array.from(easiestIds)) hardestIds.delete(teamId)

	const teamById = new Map(teams.map(t => [t.teamId, t]))
	const popularFavourable: FdrReviewCandidate[] = []
	const differentialFavourable: FdrReviewCandidate[] = []
	const popularDifficult: FdrReviewCandidate[] = []

	const {
		highOwnedPercent,
		diffOwnedMaxPercent,
		trapOwnedPercent,
		premiumPriceTenths
	} = FDR_ACTION_THRESHOLDS

	for (const signal of signals) {
		const action = enrichPlayer(signal, teamById)
		if (!action) continue

		const easy = easiestIds.has(signal.teamId)
		const hard = hardestIds.has(signal.teamId)
		const owned = signal.selectedByPercent
		const premium = signal.price >= premiumPriceTenths

		if (easy) {
			if (owned >= highOwnedPercent) popularFavourable.push(action)
			else if (owned < diffOwnedMaxPercent) differentialFavourable.push(action)
		} else if (hard && (owned >= trapOwnedPercent || premium)) {
			popularDifficult.push(action)
		}
	}

	const byOwnedDesc = (a: FdrReviewCandidate, b: FdrReviewCandidate) =>
		b.selectedByPercent - a.selectedByPercent
	const byOwnedAsc = (a: FdrReviewCandidate, b: FdrReviewCandidate) =>
		a.selectedByPercent - b.selectedByPercent

	return {
		popularFavourable: popularFavourable.sort(byOwnedDesc).slice(0, 8),
		differentialFavourable: differentialFavourable.sort(byOwnedAsc).slice(0, 8),
		popularDifficult: popularDifficult.sort(byOwnedDesc).slice(0, 8)
	}
}

export function buildFdrDeskModel(
	fixturesByEvent: Map<number, FdrPlanningFixture[]>,
	opts: {
		fromGw: number
		horizon: FdrHorizon
		marketSignals?: FixturePlanningMarketSignals | null
		marketSignalRows?: FdrPlayerSignal[]
		knownTeams?: FdrTeamIdentity[]
		unknownEvents?: ReadonlySet<number>
	}
): FdrDeskModel {
	const teams = buildTeamFdrRows(
		fixturesByEvent,
		opts.fromGw,
		opts.horizon,
		opts.knownTeams,
		opts.unknownEvents
	)
	const eligibleTeams = rankableTeams(teams)
	const easiest = [...eligibleTeams]
		.sort((a, b) => (a.avgFdr ?? 99) - (b.avgFdr ?? 99))
		.slice(0, 5)
	const hardest = [...eligibleTeams]
		.sort((a, b) => (b.avgFdr ?? -1) - (a.avgFdr ?? -1))
		.slice(0, 5)
	const signals =
		opts.marketSignalRows ?? collectMarketSignals(opts.marketSignals ?? null)
	const candidates = buildFdrReviewBuckets(teams, signals)

	return {
		fromGw: opts.fromGw,
		horizon: opts.horizon,
		teams,
		easiest,
		hardest,
		candidates
	}
}

export function formatAvgFdr(value: number | null): string {
	return value == null ? '—' : value.toFixed(1)
}

/** Average FDR with scale (official per-fixture difficulty is 1–5). */
export function formatAvgFdrOutOfFive(value: number | null): string {
	return value == null ? '—' : `${formatAvgFdr(value)}/5`
}

/** Match market signals ↔ entry picks without element ids. */
export function squadMatchKey(webName: string, teamShortName: string): string {
	return `${webName.trim().toLowerCase()}|${teamShortName.trim().toLowerCase()}`
}

export type SquadFixtureBand = 'favourable' | 'mixed' | 'difficult' | 'blank'

export type SquadFdrRow = {
	elementId: number | null
	teamId: number
	webName: string
	teamShortName: string
	elementTypeName: string
	positionCode: string
	position: number
	isStarter: boolean
	isCaptain: boolean
	isViceCaptain: boolean
	avgFdr: number | null
	easyCount: number
	hardCount: number
	blankCount: number
	nextFdr: number | null
	nextOpponent: string | null
	nextHome: boolean | null
	gameweeks: TeamFixtureGameweek[]
	run: TeamFixtureCell[]
	fixtureBand: SquadFixtureBand
}

function teamByShortName(teams: TeamFdrRow[]): Map<string, TeamFdrRow> {
	const map = new Map<string, TeamFdrRow>()
	for (const team of teams) {
		map.set(team.teamShortName.trim().toLowerCase(), team)
	}
	return map
}

function positionCodeFromElementTypeName(elementTypeName: string): string {
	const n = elementTypeName.trim().toUpperCase()
	if (n === 'GOALKEEPER' || n === 'GKP') return 'GKP'
	if (n === 'DEFENDER' || n === 'DEF') return 'DEF'
	if (n === 'MIDFIELDER' || n === 'MID') return 'MID'
	if (n === 'FORWARD' || n === 'FWD') return 'FWD'
	return 'MID'
}

function isSquadStarterPick(pick: {
	multiplier: number
	position: number
}): boolean {
	return pick.multiplier > 0 || pick.position <= 11
}

/** Non-overlapping tiers used for neutral fixture bands. */
export function getTeamTierIds(teams: TeamFdrRow[]): {
	easiestIds: Set<number>
	hardestIds: Set<number>
} {
	const sorted = rankableTeams(teams).sort(
		(a, b) => (a.avgFdr ?? 99) - (b.avgFdr ?? 99)
	)
	const tierSize = Math.min(
		FDR_TEAM_TIER_SIZE,
		Math.max(1, Math.floor(sorted.length / 2))
	)
	if (sorted.length === 0) {
		return { easiestIds: new Set(), hardestIds: new Set() }
	}
	const easiestIds = new Set(sorted.slice(0, tierSize).map(t => t.teamId))
	const hardestIds = new Set(
		sorted
			.slice(Math.max(tierSize, sorted.length - tierSize))
			.map(t => t.teamId)
	)
	// Ensure hardest doesn't re-include easiest when N is tiny
	for (const id of Array.from(easiestIds)) hardestIds.delete(id)
	return { easiestIds, hardestIds }
}

export function classifySquadFixtureBand(
	row: Pick<SquadFdrRow, 'teamId' | 'blankCount'>,
	tiers: { easiestIds: Set<number>; hardestIds: Set<number> }
): SquadFixtureBand {
	if (row.blankCount > 0) return 'blank'
	const easy = tiers.easiestIds.has(row.teamId)
	const hard = tiers.hardestIds.has(row.teamId)

	if (easy) return 'favourable'
	if (hard) return 'difficult'
	return 'mixed'
}

export function buildSquadFdrRows(
	picks: Array<{
		elementId: number | null
		webName: string
		teamShortName: string
		elementTypeName: string
		position: number
		multiplier: number
		isCaptain: boolean
		isViceCaptain: boolean
	}>,
	teams: TeamFdrRow[]
): SquadFdrRow[] {
	const byShort = teamByShortName(teams)
	const tiers = getTeamTierIds(teams)

	const rows: SquadFdrRow[] = []
	for (const pick of picks) {
		const team = byShort.get(pick.teamShortName.trim().toLowerCase())
		if (!team) continue

		const isStarter = isSquadStarterPick(pick)
		const base = {
			elementId: pick.elementId,
			webName: pick.webName,
			teamShortName: pick.teamShortName,
			elementTypeName: pick.elementTypeName,
			positionCode: positionCodeFromElementTypeName(pick.elementTypeName),
			position: pick.position,
			isStarter,
			isCaptain: pick.isCaptain,
			isViceCaptain: pick.isViceCaptain,
			teamId: team.teamId,
			avgFdr: team.avgFdr,
			easyCount: team.easyCount,
			hardCount: team.hardCount,
			blankCount: team.blankCount,
			nextFdr: team.nextFdr,
			nextOpponent: team.run[0]?.opponentShortName ?? null,
			nextHome: team.run[0]?.wasHome ?? null,
			gameweeks: team.gameweeks,
			run: team.run
		}
		rows.push({
			...base,
			fixtureBand: classifySquadFixtureBand(base, tiers)
		})
	}

	return rows
}

export function sortSquadForPlanning(rows: SquadFdrRow[]): SquadFdrRow[] {
	return [...rows].sort((a, b) => a.position - b.position)
}
