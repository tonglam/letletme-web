export const FPL_CHIPS = {
	NONE: 'NONE',
	BENCH_BOOST: 'BENCH_BOOST',
	TRIPLE_CAPTAIN: 'TRIPLE_CAPTAIN',
	FREE_HIT: 'FREE_HIT',
	WILDCARD: 'WILDCARD',
	MANAGER: 'MANAGER'
} as const

export type FplChip = (typeof FPL_CHIPS)[keyof typeof FPL_CHIPS]

export const FPL_CHIP_VALUES: readonly FplChip[] = Object.values(FPL_CHIPS)

export const isFplChip = (value: unknown): value is FplChip =>
	typeof value === 'string' && FPL_CHIP_VALUES.includes(value as FplChip)

// NONE is the absence of a played chip, not a selectable chip button.
export const LIVE_COMPETITION_CHIP_OPTIONS = [
	FPL_CHIPS.TRIPLE_CAPTAIN,
	FPL_CHIPS.BENCH_BOOST,
	FPL_CHIPS.WILDCARD,
	FPL_CHIPS.FREE_HIT,
	FPL_CHIPS.MANAGER
] as const satisfies readonly Exclude<FplChip, typeof FPL_CHIPS.NONE>[]

export type LiveCompetitionChip = (typeof LIVE_COMPETITION_CHIP_OPTIONS)[number]
