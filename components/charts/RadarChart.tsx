'use client'

import {
	PolarAngleAxis,
	PolarGrid,
	PolarRadiusAxis,
	Radar as RechartsRadar,
	RadarChart as RechartsRadarChart,
	ResponsiveContainer
} from 'recharts'

export type RadarChartDatum = {
	key: string
	label: string
	values: Record<string, number | null | undefined>
}

export type RadarChartSeries = {
	key: string
	color: string
	fillOpacity: number
}

/**
 * Shared radar adapter. Product components provide semantic axis data and
 * series colours; this adapter owns Recharts, responsive sizing and the SVG.
 *
 * Keep Recharts imports inside `components/charts`. Future line, bar and
 * scatter adapters should accept the same kind of normalized, provider-aware
 * data and own their library-specific markup here rather than in a product
 * section. This lets us change the rendering engine without changing FPL
 * metric contracts or page-level decision logic.
 */
export function RadarChart({
	data,
	series,
	ariaLabel
}: {
	data: RadarChartDatum[]
	series: RadarChartSeries[]
	ariaLabel: string
}) {
	const chartData = data.map(item => ({ axis: item.label, ...item.values }))
	return (
		<div className="h-[23rem] min-w-[18rem] w-full sm:h-[26rem]" role="img" aria-label={ariaLabel}>
			<ResponsiveContainer width="100%" height="100%">
				<RechartsRadarChart
					data={chartData}
					cx="50%"
					cy="50%"
					outerRadius="70%"
					margin={{ top: 28, right: 64, bottom: 28, left: 64 }}
					accessibilityLayer
				>
					<PolarGrid stroke="hsl(var(--border))" />
					<PolarAngleAxis
						dataKey="axis"
						tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 500 }}
					/>
					<PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
					{series.map(seriesItem => (
						<RechartsRadar
							key={seriesItem.key}
							name={seriesItem.key}
							dataKey={seriesItem.key}
							stroke={seriesItem.color}
							fill={seriesItem.color}
							fillOpacity={seriesItem.fillOpacity}
							strokeWidth={2}
							connectNulls={false}
							isAnimationActive={false}
						/>
					))}
				</RechartsRadarChart>
			</ResponsiveContainer>
		</div>
	)
}
