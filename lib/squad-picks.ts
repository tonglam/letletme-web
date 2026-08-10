import type { EntryEventPick } from '@/lib/graphql/operations/entries'
import type { EventsResponse } from '@/lib/graphql/operations/events'
import { squadMatchKey } from '@/lib/fixtures-fdr'
import { resolveReviewGameweekAnchor } from '@/lib/review-gameweek'

export type SquadPickSeed = {
	elementId: number | null
	webName: string
	teamShortName: string
	elementTypeName: string
	position: number
	multiplier: number
	isCaptain: boolean
	isViceCaptain: boolean
}

export type SquadPickSeedInput = Pick<
	EntryEventPick,
	| 'webName'
	| 'teamShortName'
	| 'elementTypeName'
	| 'position'
	| 'multiplier'
	| 'isCaptain'
	| 'isViceCaptain'
> & { element?: number | null }

export function entryPickToSquadSeed(
	pick: SquadPickSeedInput,
	elementIdByKey?: Map<string, number>,
): SquadPickSeed {
	const key = squadMatchKey(pick.webName, pick.teamShortName)
	const fromElement =
		pick.element != null && Number.isFinite(pick.element) && pick.element > 0
			? pick.element
			: null
	const fromMap = elementIdByKey?.get(key) ?? null

	return {
		elementId: fromElement ?? fromMap,
		webName: pick.webName,
		teamShortName: pick.teamShortName,
		elementTypeName: pick.elementTypeName,
		position: pick.position,
		multiplier: pick.multiplier,
		isCaptain: pick.isCaptain,
		isViceCaptain: pick.isViceCaptain,
	}
}

export function squadPicksFromEntry(
	picks: SquadPickSeedInput[],
	elementIdByKey?: Map<string, number>,
): SquadPickSeed[] {
	return picks.map(p => entryPickToSquadSeed(p, elementIdByKey))
}

export function squadPickKeys(picks: SquadPickSeed[]): string[] {
	return picks.map(p => squadMatchKey(p.webName, p.teamShortName))
}

export function positionCodeFromElementTypeName(elementTypeName: string): string {
	const n = elementTypeName.trim().toUpperCase()
	if (n === 'GOALKEEPER' || n === 'GKP') return 'GKP'
	if (n === 'DEFENDER' || n === 'DEF') return 'DEF'
	if (n === 'MIDFIELDER' || n === 'MID') return 'MID'
	if (n === 'FORWARD' || n === 'FWD') return 'FWD'
	return 'MID'
}

export function isSquadStarter<T extends { position: number }>(pick: T): boolean {
	return pick.position >= 1 && pick.position <= 11
}

export type SquadPositionCode = 'GKP' | 'DEF' | 'MID' | 'FWD'

export type SquadTeamExposure = {
	count: number
	byPos: Partial<Record<SquadPositionCode, number>>
}

const SQUAD_POS_ORDER: SquadPositionCode[] = ['GKP', 'DEF', 'MID', 'FWD']

function asSquadPositionCode(code: string): SquadPositionCode | null {
	if (code === 'GKP' || code === 'DEF' || code === 'MID' || code === 'FWD') {
		return code
	}
	return null
}

export const FPL_MAX_PLAYERS_PER_TEAM = 3

/** Per-team squad exposure (FPL max 3 from one club). Key = lowercase team short. */
export function buildSquadTeamExposure(
	picks: SquadPickSeed[],
): Map<string, SquadTeamExposure> {
	const map = new Map<string, SquadTeamExposure>()
	for (const pick of picks) {
		const key = pick.teamShortName.trim().toLowerCase()
		if (!key) continue
		const pos =
			asSquadPositionCode(positionCodeFromElementTypeName(pick.elementTypeName)) ??
			'MID'
		const cur = map.get(key) ?? { count: 0, byPos: {} }
		if (cur.count >= FPL_MAX_PLAYERS_PER_TEAM) continue
		cur.count += 1
		cur.byPos[pos] = (cur.byPos[pos] ?? 0) + 1
		map.set(key, cur)
	}
	return map
}

/** Compact label: `×2 · DEF · MID` or `×2 · 2DEF`. */
export function formatSquadTeamExposure(exposure: SquadTeamExposure): string {
	const parts: string[] = []
	for (const pos of SQUAD_POS_ORDER) {
		const n = exposure.byPos[pos]
		if (n == null || n <= 0) continue
		parts.push(n === 1 ? pos : `${n}${pos}`)
	}
	return parts.length > 0
		? `×${exposure.count} · ${parts.join(' · ')}`
		: `×${exposure.count}`
}

function positiveEventId(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) && value > 0
		? value
		: null
}

/** Candidate event ids in descending order — probe latest GW first for existing picks. */
export function squadPickEventCandidates(
	events: EventsResponse | null | undefined,
	historyEventIds?: number[] | null,
): number[] {
	const historyMax = historyEventIds?.length
		? Math.max(...historyEventIds.filter(id => id > 0))
		: null
	const review = resolveReviewGameweekAnchor(events, {
		historyMaxEventId: historyMax,
	})
	const ids = new Set<number>()

	for (const id of historyEventIds ?? []) {
		if (id > 0) ids.add(id)
	}
	const push = (id: number | null | undefined) => {
		if (id != null && id > 0) ids.add(id)
	}
	push(positiveEventId(events?.next?.[0]?.id))
	push(review.anchorGw)
	push(review.currentGw)

	return Array.from(ids).sort((a, b) => b - a)
}
