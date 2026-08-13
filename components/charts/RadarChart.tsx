'use client'

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

const WIDTH = 520
const HEIGHT = 420
const CENTER_X = WIDTH / 2
const CENTER_Y = 195
const RADIUS = 140
const LABEL_RADIUS = 178

function point(index: number, count: number, radius: number) {
	const angle = -Math.PI / 2 + (index * Math.PI * 2) / count
	return {
		x: CENTER_X + Math.cos(angle) * radius,
		y: CENTER_Y + Math.sin(angle) * radius
	}
}

function pointsForRadius(count: number, radius: number): string {
	return Array.from({ length: count }, (_, index) =>
		point(index, count, radius)
	)
		.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`)
		.join(' ')
}

function seriesPoints(data: RadarChartDatum[], key: string): string {
	return data
		.map((datum, index) => {
			const rawValue = datum.values[key]
			const value =
				typeof rawValue === 'number' && Number.isFinite(rawValue)
					? Math.max(0, Math.min(100, rawValue))
					: 0
			const { x, y } = point(index, data.length, (RADIUS * value) / 100)
			return `${x.toFixed(2)},${y.toFixed(2)}`
		})
		.join(' ')
}

/** Lightweight, fixed-size SVG radar for the first player-detail path. */
export function RadarChart({
	data,
	series,
	ariaLabel
}: {
	data: RadarChartDatum[]
	series: RadarChartSeries[]
	ariaLabel: string
}) {
	if (data.length < 3) return null
	return (
		<div
			className="h-[23rem] min-w-[18rem] w-full sm:h-[26rem]"
			role="img"
			aria-label={ariaLabel}
		>
			<svg
				viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
				className="h-full w-full overflow-visible"
				aria-hidden="true"
				focusable="false"
			>
				<title>{ariaLabel}</title>
				{[0.25, 0.5, 0.75, 1].map(level => (
					<polygon
						key={level}
						points={pointsForRadius(data.length, RADIUS * level)}
						fill="none"
						stroke="hsl(var(--border))"
						strokeWidth={level === 1 ? 1.5 : 1}
					/>
				))}
				{data.map((datum, index) => {
					const outer = point(index, data.length, RADIUS)
					const label = point(index, data.length, LABEL_RADIUS)
					const anchor =
						label.x < CENTER_X - 8
							? 'end'
							: label.x > CENTER_X + 8
								? 'start'
								: 'middle'
					return (
						<g key={datum.key}>
							<line
								x1={CENTER_X}
								y1={CENTER_Y}
								x2={outer.x}
								y2={outer.y}
								stroke="hsl(var(--border))"
							/>
							<text
								x={label.x}
								y={label.y}
								textAnchor={anchor}
								dominantBaseline="middle"
								fill="hsl(var(--muted-foreground))"
								fontSize="12"
								fontWeight="500"
							>
								{datum.label}
							</text>
						</g>
					)
				})}
				{series.map(item => (
					<polygon
						key={item.key}
						points={seriesPoints(data, item.key)}
						fill={item.color}
						fillOpacity={item.fillOpacity}
						stroke={item.color}
						strokeWidth="2"
						strokeLinejoin="round"
					/>
				))}
			</svg>
			<ul className="sr-only">
				{data.map(datum => (
					<li key={datum.key}>
						{datum.label}:{' '}
						{series
							.map(item => {
								const value = datum.values[item.key]
								return `${item.key} ${typeof value === 'number' ? Math.round(value) : 'unavailable'}`
							})
							.join(', ')}
					</li>
				))}
			</ul>
		</div>
	)
}
