export const FPL_STARTING_PLAYERS = 11
export const FPL_SQUAD_PLAYERS = 15

/**
 * The "played" scoreboard denominator is the number of players eligible to
 * score in the gameweek, not the number of players currently returned by a
 * live calculation. Bench Boost activates the full 15-player squad;
 * otherwise only the starting XI is eligible.
 */
export function getPlayedPlayerLimit(chips: { bench: boolean }): 11 | 15 {
	return chips.bench ? FPL_SQUAD_PLAYERS : FPL_STARTING_PLAYERS
}
