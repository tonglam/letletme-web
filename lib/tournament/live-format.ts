/** Stable display formatting shared by the publication-backed live boards. */
const liveAverageFormatter = new Intl.NumberFormat('en-GB', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
	useGrouping: false
})

export const formatLiveAveragePoints = (value: number): string =>
	Number.isFinite(value) ? liveAverageFormatter.format(value) : '—'
