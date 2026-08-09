'use client'

import {
	Bar,
	CartesianGrid,
	Cell,
	ComposedChart as RechartsComposedChart,
	Line,
	LineChart as RechartsLineChart,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts'
import type { ReactNode } from 'react'

export type ChartValue = string | number | null | undefined

export type ChartDatum = {
	x: ChartValue
	[key: string]: ChartValue
}

export type ChartSeries = {
	key: string
	label: string
	color: string
	dashed?: boolean
	strokeWidth?: number
	fillOpacity?: number
}

type SharedChartProps = {
	data: ChartDatum[]
	ariaLabel: string
	heightClassName?: string
	onActivePointChange?: (point: ChartDatum | null) => void
	onPointClick?: (point: ChartDatum) => void
	xFormatter?: (value: ChartValue) => string
	yFormatter?: (value: ChartValue) => string
	invertY?: boolean
}

function activePoint(state: unknown): ChartDatum | null {
	if (!state || typeof state !== 'object') return null
	const payload = (state as { activePayload?: Array<{ payload?: unknown }> }).activePayload
	const point = payload?.[0]?.payload
	return point && typeof point === 'object' ? (point as ChartDatum) : null
}

function ChartShell({
	ariaLabel,
	heightClassName = 'h-[11rem]',
	children,
}: {
	ariaLabel: string
	heightClassName?: string
	children: ReactNode
}) {
	return (
		<div className={`${heightClassName} w-full min-w-0`} role="img" aria-label={ariaLabel}>
			<ResponsiveContainer width="100%" height="100%">
				{children}
			</ResponsiveContainer>
		</div>
	)
}

export function LineChart({
	data,
	series,
	ariaLabel,
	heightClassName,
	onActivePointChange,
	onPointClick,
	xFormatter,
	yFormatter,
	invertY = false,
}: SharedChartProps & { series: ChartSeries[] }) {
	return (
		<ChartShell ariaLabel={ariaLabel} heightClassName={heightClassName}>
			<RechartsLineChart
				data={data}
				margin={{ top: 12, right: 12, bottom: 4, left: 8 }}
				accessibilityLayer
				onMouseMove={state => onActivePointChange?.(activePoint(state))}
				onMouseLeave={() => onActivePointChange?.(null)}
				onClick={state => {
					const point = activePoint(state)
					if (point) onPointClick?.(point)
				}}
			>
				<CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.6} strokeDasharray="3 3" />
				<XAxis
					dataKey="x"
					stroke="hsl(var(--muted-foreground))"
					tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
					tickFormatter={value => xFormatter?.(value) ?? String(value ?? '—')}
					axisLine={false}
					tickLine={false}
					minTickGap={12}
				/>
				<YAxis
					reversed={invertY}
					domain={['auto', 'auto']}
					stroke="hsl(var(--muted-foreground))"
					tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
					tickFormatter={value => yFormatter?.(value) ?? String(value ?? '—')}
					axisLine={false}
					tickLine={false}
					width={42}
				/>
				<Tooltip
					cursor={{ stroke: 'hsl(var(--primary))', strokeOpacity: 0.25 }}
					contentStyle={{
						background: 'hsl(var(--background))',
						border: '1px solid hsl(var(--border))',
						borderRadius: '0.5rem',
						fontSize: '0.75rem',
					}}
				/>
				{series.map(item => (
					<Line
						key={item.key}
						dataKey={item.key}
						name={item.label}
						stroke={item.color}
						strokeWidth={item.strokeWidth ?? 2}
						strokeDasharray={item.dashed ? '5 4' : undefined}
						dot={{ r: item.dashed ? 0 : 2 }}
						activeDot={{ r: 4 }}
						connectNulls={false}
						isAnimationActive={false}
					/>
				))}
			</RechartsLineChart>
		</ChartShell>
	)
}

export function BarChart({
	data,
	series,
	ariaLabel,
	heightClassName,
	onActivePointChange,
	onPointClick,
	xFormatter,
	yFormatter,
	referenceY,
	baseline = false,
}: SharedChartProps & {
	series: [ChartSeries]
	referenceY?: number | null
	baseline?: boolean
}) {
	const primary = series[0]
	return (
		<ChartShell ariaLabel={ariaLabel} heightClassName={heightClassName}>
			<RechartsComposedChart
				data={data}
				margin={{ top: 12, right: 12, bottom: 4, left: 8 }}
				accessibilityLayer
				onMouseMove={state => onActivePointChange?.(activePoint(state))}
				onMouseLeave={() => onActivePointChange?.(null)}
				onClick={state => {
					const point = activePoint(state)
					if (point) onPointClick?.(point)
				}}
			>
				<CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.6} strokeDasharray="3 3" />
				<XAxis
					dataKey="x"
					stroke="hsl(var(--muted-foreground))"
					tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
					tickFormatter={value => xFormatter?.(value) ?? String(value ?? '—')}
					axisLine={false}
					tickLine={false}
					minTickGap={12}
				/>
				<YAxis
					domain={['auto', 'auto']}
					stroke="hsl(var(--muted-foreground))"
					tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
					tickFormatter={value => yFormatter?.(value) ?? String(value ?? '—')}
					axisLine={false}
					tickLine={false}
					width={42}
				/>
				<Tooltip
					cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.35 }}
					contentStyle={{
						background: 'hsl(var(--background))',
						border: '1px solid hsl(var(--border))',
						borderRadius: '0.5rem',
						fontSize: '0.75rem',
					}}
				/>
				{baseline ? <ReferenceLine y={0} stroke="hsl(var(--border))" /> : null}
				{referenceY != null ? (
					<ReferenceLine y={referenceY} stroke={primary.color} strokeOpacity={0.55} strokeDasharray="4 3" />
				) : null}
				<Bar dataKey={primary.key} name={primary.label} isAnimationActive={false}>
					{data.map((point, index) => (
						<Cell key={`${String(point.x)}-${index}`} fill={String(point.fill ?? primary.color)} fillOpacity={Number(point.opacity ?? 0.9)} />
					))}
				</Bar>
			</RechartsComposedChart>
		</ChartShell>
	)
}

export function ComboChart({
	data,
	line,
	bar,
	ariaLabel,
	heightClassName,
	onActivePointChange,
	onPointClick,
	xFormatter,
	yFormatter,
	invertY = false,
	markerXs = [],
}: SharedChartProps & {
	line: ChartSeries
	bar: ChartSeries
	markerXs?: Array<string | number>
}) {
	return (
		<ChartShell ariaLabel={ariaLabel} heightClassName={heightClassName}>
			<RechartsComposedChart
				data={data}
				margin={{ top: 12, right: 12, bottom: 4, left: 8 }}
				accessibilityLayer
				onMouseMove={state => onActivePointChange?.(activePoint(state))}
				onMouseLeave={() => onActivePointChange?.(null)}
				onClick={state => {
					const point = activePoint(state)
					if (point) onPointClick?.(point)
				}}
			>
				<CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.6} strokeDasharray="3 3" />
				<XAxis
					dataKey="x"
					stroke="hsl(var(--muted-foreground))"
					tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
					tickFormatter={value => xFormatter?.(value) ?? String(value ?? '—')}
					axisLine={false}
					tickLine={false}
					minTickGap={12}
				/>
				<YAxis
					yAxisId="line"
					reversed={invertY}
					domain={['auto', 'auto']}
					stroke="hsl(var(--muted-foreground))"
					tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
					tickFormatter={value => yFormatter?.(value) ?? String(value ?? '—')}
					axisLine={false}
					tickLine={false}
					width={42}
				/>
				<YAxis yAxisId="bar" domain={['auto', 'auto']} hide />
				<Tooltip
					cursor={{ stroke: 'hsl(var(--primary))', strokeOpacity: 0.25 }}
					contentStyle={{
						background: 'hsl(var(--background))',
						border: '1px solid hsl(var(--border))',
						borderRadius: '0.5rem',
						fontSize: '0.75rem',
					}}
				/>
				{markerXs.map((value, index) => (
					<ReferenceLine key={`${String(value)}-${index}`} x={value} yAxisId="line" stroke="hsl(var(--plum))" strokeOpacity={0.35} strokeDasharray="3 3" />
				))}
				<Bar dataKey={bar.key} name={bar.label} yAxisId="bar" isAnimationActive={false}>
					{data.map((point, index) => (
						<Cell key={`${String(point.x)}-${index}`} fill={String(point.fill ?? bar.color)} fillOpacity={Number(point.opacity ?? bar.fillOpacity ?? 0.2)} />
					))}
				</Bar>
				<Line
					dataKey={line.key}
					name={line.label}
					yAxisId="line"
					stroke={line.color}
					strokeWidth={line.strokeWidth ?? 2.25}
					dot={{ r: 2 }}
					activeDot={{ r: 4 }}
					connectNulls={false}
					isAnimationActive={false}
				/>
			</RechartsComposedChart>
		</ChartShell>
	)
}
