import type { MarketPriceChange } from '@/lib/graphql/operations/market'
import { normalizePosition } from '@/lib/utils'

export type PriceMovementShareLabels = {
	/** e.g. "Price changes" */
	title: string
	/** e.g. "Rises" */
	rises: string
	/** e.g. "Falls" */
	falls: string
	/** When no rises/falls in a column */
	none: string
	/** Optional footer, may include {url} */
	footer?: string
}

export type FormatPriceMovementShareInput = {
	changes: MarketPriceChange[]
	/**
	 * Single change day for the board (price moves are daily).
	 * Accepts YYYY-MM-DD / ISO, or a pre-formatted label.
	 */
	changeDate?: string | null
	labels: PriceMovementShareLabels
}

function formatMoneyTenths(tenths: number): string {
	return `£${(tenths / 10).toFixed(1)}m`
}

/** YYYY-MM-DD or ISO → DD/MM/yyyy for share paste. */
export function formatShareChangeDate(value: string): string {
	const day = value.slice(0, 10)
	if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return value
	const [y, m, d] = day.split('-')
	return `${d}/${m}/${y}`
}

function formatChangeLine(change: MarketPriceChange): string {
	const name = change.player.webName
	const pos = normalizePosition(change.player.position)
	const team = change.player.teamShortName
	const from = formatMoneyTenths(change.oldPrice)
	const to = formatMoneyTenths(change.newPrice)
	// Date in header; direction from Rises/Falls section
	const posPart = pos === 'UNK' ? '' : ` ${pos}`
	return `- ${name}${posPart} ${team} · ${from} → ${to}`
}

/**
 * Plain-text price movement summary for social share (same idea as live points).
 * Price board is always one calendar day.
 */
export function formatPriceMovementShareText({
	changes,
	changeDate,
	labels,
}: FormatPriceMovementShareInput): string {
	const rises = changes.filter(c => c.direction === 'RISE')
	const falls = changes.filter(c => c.direction === 'FALL')

	const rawDate = changeDate?.trim()
	const dateLabel = rawDate
		? /^\d{4}-\d{2}-\d{2}/.test(rawDate)
			? formatShareChangeDate(rawDate)
			: rawDate
		: null

	const header = dateLabel
		? `${labels.title} · ${dateLabel}`
		: labels.title

	const sections: string[] = [header, '']

	sections.push(`${labels.rises} (${rises.length})`)
	if (rises.length === 0) {
		sections.push(labels.none)
	} else {
		for (const c of rises) sections.push(formatChangeLine(c))
	}

	sections.push('')
	sections.push(`${labels.falls} (${falls.length})`)
	if (falls.length === 0) {
		sections.push(labels.none)
	} else {
		for (const c of falls) sections.push(formatChangeLine(c))
	}

	if (labels.footer) {
		sections.push('', labels.footer)
	}

	return sections.join('\n')
}

export function buildMarketShareUrl(
	origin: string,
	localePathPrefix: string = '',
): string {
	const base = origin.replace(/\/$/, '')
	const prefix = localePathPrefix.replace(/\/$/, '')
	const path = `${prefix}/data/market`
	return `${base}${path.startsWith('/') ? path : `/${path}`}`
}
