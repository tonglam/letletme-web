import type {
	LiveCalcData,
	LivePick
} from '@/lib/graphql/operations/live'

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
	(chip ?? '')
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, '')

export const isBenchBoostChip = (chip: string | null | undefined): boolean => {
	const normalized = normalizeChip(chip)
	return (
		normalized === 'BB' ||
		normalized === 'BBOOST' ||
		normalized === 'BENCHBOOST'
	)
}

/**
 * A player is ruled out only after all of that player's GW fixtures have ended.
 * `isPlayed` is not an appearance-only signal in the GraphQL contract: it is
 * also true for a zero-minute player who receives a touchline card.
 */
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
	live.score?.delivery.state === 'FINAL' ||
	live.snapshot?.state === 'FINALIZED' ||
	live.snapshot?.state === 'GW_REVIEW'

const deriveOfficialProjection = ({
	picks,
	picksById,
	effectivePositions,
	benchBoostActive
}: {
	picks: LivePick[]
	picksById: ReadonlyMap<string, LivePick>
	effectivePositions: Record<string, number>
	benchBoostActive: boolean
}): LiveAutoSubProjection => {
	// Terminal entry rows already contain FPL's settled multipliers and active
	// flags. They take precedence over any inference from minutes, including
	// after a late official correction.
	const hasPublishedActiveFlags = picks.every(
		pick => typeof pick.pickActive === 'boolean'
	)
	const activeIds = new Set(
		picks
			.filter(pick =>
				benchBoostActive
					? pick.position <= 11
					: hasPublishedActiveFlags
						? pick.pickActive === true
						: (pick.multiplier ?? 0) > 0
			)
			.map(pick => String(pick.element))
	)
	const originalCaptain = picks.find(pick => pick.isCaptain) ?? null
	const publishedCaptain =
		picks.find(pick => (pick.multiplier ?? 0) >= 2) ?? null
	const captainPromotion =
		originalCaptain &&
		publishedCaptain &&
		publishedCaptain.element !== originalCaptain.element
			? {
					playerInId: String(publishedCaptain.element),
					playerInName: publishedCaptain.webName,
					playerOutId: String(originalCaptain.element),
					playerOutName: originalCaptain.webName,
					state: 'OFFICIAL' as const
				}
			: null

	if (benchBoostActive) {
		return {
			state: captainPromotion ? 'OFFICIAL' : 'NONE',
			benchBoostActive,
			substitutions: [],
			captainPromotion,
			activePlayerIds: Array.from(activeIds),
			effectivePositions
		}
	}

	const outgoing = picks
		.filter(pick => pick.position <= 11 && !activeIds.has(String(pick.element)))
		.sort((left, right) => left.position - right.position)
	const incoming = picks
		.filter(
			pick =>
				pick.position > 11 &&
				activeIds.has(String(pick.element)) &&
				(pick.autoSub === true || pick.pickActive === true)
		)
		.sort((left, right) => left.position - right.position)
	const remainingOutgoing = [...outgoing]
	const presentationActiveIds = new Set(
		picks.filter(pick => pick.position <= 11).map(pick => String(pick.element))
	)
	const substitutions: LiveAutoSubstitution[] = []

	for (const benchPlayer of incoming) {
		if (remainingOutgoing.length === 0) break

		// The public contract identifies the settled active players, but not the
		// individual in/out pair. Reconstruct that label without ever changing
		// the authoritative active set used to render the XI.
		let outgoingIndex = remainingOutgoing.findIndex(starter => {
			const nextActiveIds = new Set(presentationActiveIds)
			nextActiveIds.delete(String(starter.element))
			nextActiveIds.add(String(benchPlayer.element))
			return isValidFormation(picksById, nextActiveIds)
		})
		if (outgoingIndex < 0) {
			outgoingIndex = remainingOutgoing.findIndex(
				starter =>
					(starter.elementType === 1) === (benchPlayer.elementType === 1)
			)
		}
		if (outgoingIndex < 0) outgoingIndex = 0

		const [starter] = remainingOutgoing.splice(outgoingIndex, 1)
		const starterId = String(starter.element)
		const benchPlayerId = String(benchPlayer.element)
		presentationActiveIds.delete(starterId)
		presentationActiveIds.add(benchPlayerId)
		effectivePositions[benchPlayerId] = starter.position
		effectivePositions[starterId] = benchPlayer.position
		substitutions.push({
			playerInId: benchPlayerId,
			playerInName: benchPlayer.webName,
			playerInOriginalPosition: benchPlayer.position,
			playerOutId: starterId,
			playerOutName: starter.webName,
			playerOutOriginalPosition: starter.position,
			state: 'OFFICIAL'
		})
	}

	return {
		state:
			substitutions.length > 0 || captainPromotion !== null
				? 'OFFICIAL'
				: 'NONE',
		benchBoostActive,
		substitutions,
		captainPromotion,
		activePlayerIds: Array.from(activeIds),
		effectivePositions
	}
}

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
	const benchBoostActive = isBenchBoostChip(live.chip)
	if (isOfficialLineup(live)) {
		return deriveOfficialProjection({
			picks,
			picksById,
			effectivePositions,
			benchBoostActive
		})
	}

	const activeIds = new Set(
		picks.filter(pick => pick.position <= 11).map(pick => String(pick.element))
	)
	const state: Exclude<LiveAutoSubState, 'NONE'> = 'PREDICTED'
	const originalCaptain = picks.find(pick => pick.isCaptain) ?? null
	const viceCaptain = picks.find(pick => pick.isViceCaptain) ?? null
	const viceCaptainId = viceCaptain ? String(viceCaptain.element) : null
	const deriveCaptainPromotion = (): LiveCaptainPromotion | null =>
		originalCaptain &&
		viceCaptain &&
		viceCaptainId &&
		completedWithoutPlaying(originalCaptain) &&
		viceCaptain.minutes > 0 &&
		activeIds.has(viceCaptainId)
			? {
					playerInId: viceCaptainId,
					playerInName: viceCaptain.webName,
					playerOutId: String(originalCaptain.element),
					playerOutName: originalCaptain.webName,
					state
				}
			: null

	if (benchBoostActive) {
		const captainPromotion = deriveCaptainPromotion()
		return {
			state: captainPromotion ? state : 'NONE',
			benchBoostActive,
			substitutions: [],
			captainPromotion,
			activePlayerIds: Array.from(activeIds),
			effectivePositions
		}
	}

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

	const captainPromotion = deriveCaptainPromotion()

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
