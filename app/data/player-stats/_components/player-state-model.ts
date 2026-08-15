import type { useFormatter } from 'next-intl'
import type {
	PlayerStateDimension,
	PlayerStateDimensionKind,
	PlayerStateMetric,
	PlayerStateProfileData
} from '@/lib/graphql/operations/players'

export type PlayerStateFormatter = ReturnType<typeof useFormatter>

export function profileDimension(
	profile: PlayerStateProfileData,
	kind: PlayerStateDimensionKind
): PlayerStateDimension | null {
	return profile.dimensions.find(dimension => dimension.kind === kind) ?? null
}

export function dimensionMetric(
	dimension: PlayerStateDimension | null,
	code: string
): PlayerStateMetric | null {
	return dimension?.metrics.find(metric => metric.code === code) ?? null
}

export function seasonLabel(season: string): string {
	if (!/^\d{4}$/.test(season)) return season
	return `20${season.slice(0, 2)}/${season.slice(2)}`
}

export function formatMetricValue(
	metric: PlayerStateMetric | null,
	format: PlayerStateFormatter
): string | null {
	if (!metric || metric.value == null) return null
	 switch (metric.unit) {
		case 'percent':
			return `${format.number(metric.value, { maximumFractionDigits: 1 })}%`
		case 'percentile':
			return format.number(metric.value, { maximumFractionDigits: 1 })
		case 'per90':
			return format.number(metric.value, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			})
		case 'fdr':
			return format.number(metric.value, { maximumFractionDigits: 2 })
		default:
			return format.number(metric.value, { maximumFractionDigits: 1 })
	}
}
