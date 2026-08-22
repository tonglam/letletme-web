import type { PriceChangePlayer } from '@/lib/graphql/operations/price-changes'

export type PriceChangeShareLabels = {
	title: string
	scope: string
	deadline: string
	progress: string
	signal: string
	movement: string
	none: string
	status: Record<PriceChangePlayer['status'], string>
	footer?: string
}

function formatPrice(value: number): string {
	return `£${(value / 10).toFixed(1)}m`
}

function formatPercent(value: number): string {
	if (Math.abs(value) < 0.05) return '0.0%'
	return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function formatMovement(player: PriceChangePlayer): string {
	const net = player.transfersInEvent - player.transfersOutEvent
	return `${net > 0 ? '+' : ''}${net.toLocaleString()}`
}

export function formatPriceChangeShareText({
	players,
	deadlineLabel,
	labels,
	maxPlayers = 20,
}: {
	players: readonly PriceChangePlayer[]
	deadlineLabel?: string | null
	labels: PriceChangeShareLabels
	maxPlayers?: number
}): string {
	const selected = players.slice(0, maxPlayers)
	const sections = [
		`${labels.title} · ${labels.scope}`,
		...(deadlineLabel ? [`${labels.deadline}: ${deadlineLabel}`] : []),
		'',
	]

	if (selected.length === 0) {
		sections.push(labels.none)
	} else {
		for (const player of selected) {
			sections.push(
				`- ${player.webName} ${player.teamShortName} · ${formatPrice(player.currentPrice)} · ${labels.progress} ${formatPercent(player.progressPercent)} · ${labels.signal} ${labels.status[player.status]} · ${labels.movement} ${formatMovement(player)}`,
			)
		}
		if (players.length > selected.length) {
			sections.push(`… +${players.length - selected.length}`)
		}
	}

	if (labels.footer?.trim()) sections.push('', labels.footer.trim())
	return sections.join('\n')
}
