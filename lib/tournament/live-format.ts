/** Stable display formatting shared by the publication-backed live boards. */
export const formatLiveAveragePoints = (value: number): string =>
	value.toFixed(1).replace(/\.0$/, '')
