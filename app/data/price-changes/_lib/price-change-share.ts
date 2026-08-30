import type { PriceChangePlayer } from '@/lib/graphql/operations/price-changes'
import type { SquadPickSeed } from '@/lib/squad-picks'
import { isLikelyToChange } from '@/lib/price-change-sorting'

export const PRICE_CHANGE_SHARE_STATUSES = [
	'LIKELY_RISE',
	'VERY_LIKELY_RISE',
	'LIKELY_FALL',
	'VERY_LIKELY_FALL'
] as const

export const PRICE_CHANGE_SHARE_MAX_PLAYERS = 20

/** Keep one-image/text prediction shares focused on actionable rise/fall signals. */
export function selectPriceChangeSharePlayers(
	players: readonly PriceChangePlayer[]
): PriceChangePlayer[] {
	return players.filter(
		player =>
			isLikelyToChange(player) &&
			player.progressPercent !== 0 &&
			PRICE_CHANGE_SHARE_STATUSES.some(status => status === player.status)
	)
}

function squadPlayerKey(webName: string, teamShortName: string): string {
	return `${webName.trim().toLowerCase()}::${teamShortName.trim().toLowerCase()}`
}

/** Match the linked squad to the board before either share format filters it. */
export function selectPriceChangeSquadPlayers(
	players: readonly PriceChangePlayer[],
	picks: readonly SquadPickSeed[]
): PriceChangePlayer[] {
	const playerById = new Map(
		players.map(player => [player.playerId, player])
	)
	const playerByKey = new Map(
		players.map(player => [
			squadPlayerKey(player.webName, player.teamShortName),
			player
		])
	)

	return picks
		.map(
			pick =>
				(pick.elementId != null
					? playerById.get(pick.elementId)
					: undefined) ??
				playerByKey.get(squadPlayerKey(pick.webName, pick.teamShortName))
		)
		.filter((player): player is PriceChangePlayer => player != null)
}

export type PriceChangeShareLabels = {
	title: string
	scope: string
	updated: string
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
	updatedAtLabel,
	deadlineLabel,
	labels,
	maxPlayers = PRICE_CHANGE_SHARE_MAX_PLAYERS,
}: {
	players: readonly PriceChangePlayer[]
	updatedAtLabel?: string | null
	deadlineLabel?: string | null
	labels: PriceChangeShareLabels
	maxPlayers?: number
}): string {
	const sharePlayers = selectPriceChangeSharePlayers(players)
	const selected = sharePlayers.slice(0, maxPlayers)
	const sections = [
		`${labels.title} · ${labels.scope}`,
		...(updatedAtLabel ? [`${labels.updated}: ${updatedAtLabel}`] : []),
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
		if (sharePlayers.length > selected.length) {
			sections.push(`… +${sharePlayers.length - selected.length}`)
		}
	}

	if (labels.footer?.trim()) sections.push('', labels.footer.trim())
	return sections.join('\n')
}
