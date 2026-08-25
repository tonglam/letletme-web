import type { LiveCalcData, LivePick } from '@/lib/graphql/operations/live'

type ProjectionInput = Pick<
	LiveCalcData,
	'chip' | 'pickList' | 'score' | 'snapshot'
>

export type LiveAutoSubState = 'NONE' | 'PREDICTED' | 'OFFICIAL'

export type LiveAutoSubstitution = {
	playerInId: string
	playerInName: string
	playerInOriginalPosition: number
	playerOutId: string
	playerOutName: string
	playerOutOriginalPosition: number
	state: Exclude<LiveAutoSubState, 'NONE'>
}

export type LiveCaptainPromotion = {
	playerInId: string
	playerInName: string
	playerOutId: string
	playerOutName: string
	state: Exclude<LiveAutoSubState, 'NONE'>
}

export type LiveAutoSubProjection = {
	state: LiveAutoSubState
	benchBoostActive: boolean
	substitutions: LiveAutoSubstitution[]
	captainPromotion: LiveCaptainPromotion | null
	activePlayerIds: string[]
	effectivePositions: Record<string, number>
}

const normalizeChip = (chip: string | null | undefined): string =>
	(chip ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')

export const isBenchBoostChip = (
	chip: string | null | undefined
): boolean => {
	const normalized = normalizeChip(chip)
	return (
		normalized === 'BB' ||
		normalized === 'BBOOST' ||
		normalized === 'BENCHBOOST'
	)
}

/** A player is ruled out only after all of that player's GW fixtures have ended. */
const completedWithoutPlaying = (pick: LivePick): boolean =>
	pick.minutes === 0 && (pick.isGwFinished === true || pick.bgw === true)

const isValidFormation = (
	picksById: ReadonlyMap<string, LivePick>,
	activeIds: ReadonlySet<string>
): boolean => {
	let goalkeepers = 0
	let defenders = 0
	let midfielders = 0
	let forwards = 0

	activeIds.forEach(id => {
		const pick = picksById.get(id)
		if (!pick) return
		switch (pick.elementType) {
			case 1:
				goalkeepers += 1
				break
			case 2:
				defenders += 1
				break
			case 3:
				midfielders += 1
				break
			case 4:
				forwards += 1
				break
		}
	})

	return (
		activeIds.size === 11 &&
		goalkeepers === 1 &&
		defenders >= 3 &&
		defenders <= 5 &&
		midfielders >= 2 &&
		midfielders <= 5 &&
		forwards >= 1 &&
		forwards <= 3
	)
}

const isOfficialLineup = (live: ProjectionInput): boolean =>
	live.score?.state === 'FINAL' || live.snapshot?.state === 'FINALIZED'

/**
 * Derive the XI that should be shown right now.
 *
 * Once a starter is a confirmed zero-minute no-show, bench players are tried in
 * their FPL order. A bench player whose own fixture is still pending is kept as
 * the current prediction; only a confirmed bench no-show is skipped. Every swap
 * must leave a legal 11-player formation.
 */
export function deriveLiveAutoSubProjection(
	live: ProjectionInput
): LiveAutoSubProjection {
	const picks = [...live.pickList].sort(
		(left, right) => left.position - right.position
	)
	const picksById = new Map(
		picks.map(pick => [String(pick.element), pick] as const)
	)
	const effectivePositions = Object.fromEntries(
		picks.map(pick => [String(pick.element), pick.position])
	)
	const activeIds = new Set(
		picks
			.filter(pick => pick.position <= 11)
			.map(pick => String(pick.element))
	)
	const benchBoostActive = isBenchBoostChip(live.chip)

	if (benchBoostActive) {
		return {
			state: 'NONE',
			benchBoostActive,
			substitutions: [],
			captainPromotion: null,
			activePlayerIds: Array.from(activeIds),
			effectivePositions
		}
	}

	const state: Exclude<LiveAutoSubState, 'NONE'> = isOfficialLineup(live)
		? 'OFFICIAL'
		: 'PREDICTED'
	const nonPlayingStarters = picks
		.filter(pick => pick.position <= 11 && completedWithoutPlaying(pick))
		.sort((left, right) => left.position - right.position)
	const bench = picks
		.filter(pick => pick.position > 11)
		.sort((left, right) => left.position - right.position)
	const substitutions: LiveAutoSubstitution[] = []

	for (const benchPlayer of bench) {
		if (nonPlayingStarters.length === 0) break
		// A pending bench player is the current prediction. Skip only once that
		// player's own GW fixtures have all ended without an appearance.
		if (completedWithoutPlaying(benchPlayer)) continue

		for (let index = 0; index < nonPlayingStarters.length; index += 1) {
			const starter = nonPlayingStarters[index]
			const starterId = String(starter.element)
			const benchPlayerId = String(benchPlayer.element)
			const nextActiveIds = new Set(activeIds)
			nextActiveIds.delete(starterId)
			nextActiveIds.add(benchPlayerId)
			if (!isValidFormation(picksById, nextActiveIds)) continue

			activeIds.clear()
			nextActiveIds.forEach(id => activeIds.add(id))
			effectivePositions[benchPlayerId] = starter.position
			effectivePositions[starterId] = benchPlayer.position
			nonPlayingStarters.splice(index, 1)
			substitutions.push({
				playerInId: benchPlayerId,
				playerInName: benchPlayer.webName,
				playerInOriginalPosition: benchPlayer.position,
				playerOutId: starterId,
				playerOutName: starter.webName,
				playerOutOriginalPosition: starter.position,
				state
			})
			break
		}
	}

	const originalCaptain = picks.find(pick => pick.isCaptain) ?? null
	const viceCaptain = picks.find(pick => pick.isViceCaptain) ?? null
	const viceCaptainId = viceCaptain ? String(viceCaptain.element) : null
	const captainPromotion =
		originalCaptain &&
		viceCaptain &&
		viceCaptainId &&
		completedWithoutPlaying(originalCaptain) &&
		!completedWithoutPlaying(viceCaptain) &&
		activeIds.has(viceCaptainId)
			? {
					playerInId: viceCaptainId,
					playerInName: viceCaptain.webName,
					playerOutId: String(originalCaptain.element),
					playerOutName: originalCaptain.webName,
					state
				}
			: null

	return {
		state:
			substitutions.length > 0 || captainPromotion !== null ? state : 'NONE',
		benchBoostActive,
		substitutions,
		captainPromotion,
		activePlayerIds: Array.from(activeIds),
		effectivePositions
	}
}
