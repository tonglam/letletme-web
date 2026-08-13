import type { TournamentStatPlayer } from '@/lib/graphql/operations/tournaments'
import { normalizePosition } from '@/lib/utils'

export type SelectionsShareLabels = {
	/** Section title, e.g. "Squad ownership" */
	title: string
	/** Optional empty column label */
	none: string
	/** e.g. "Field: {count} managers" — already interpolated or use fieldTemplate */
	fieldLine?: string
	/** Sub-section headers for transfer desk */
	transfersIn?: string
	transfersOut?: string
	footer?: string
}

export type SelectionsShareScope = {
	tournamentName: string
	gameweek: number
	totalEntries?: number
}

function posCode(position: string): string {
	const code = normalizePosition(position)
	return code === 'UNK' ? '' : code
}

function playerBits(player: TournamentStatPlayer): string {
	const pos = posCode(player.position)
	const posPart = pos ? ` ${pos}` : ''
	return `${player.webName}${posPart} ${player.teamShortName}`
}

function pct(value: number | undefined | null): string {
	if (value == null || !Number.isFinite(value)) return '—'
	return `${value.toFixed(1)}%`
}

function count(value: number | undefined | null): string {
	if (value == null || !Number.isFinite(value)) return '—'
	return String(Math.round(value))
}

function headerLine(
	title: string,
	scope: SelectionsShareScope,
): string {
	return `${title} · ${scope.tournamentName} · GW${scope.gameweek}`
}

function withFooter(sections: string[], footer?: string): string {
	if (footer?.trim()) {
		sections.push('', footer.trim())
	}
	return sections.join('\n')
}

/** Ownership board share text. */
export function formatOwnershipShareText(
	players: TournamentStatPlayer[],
	scope: SelectionsShareScope,
	labels: SelectionsShareLabels,
): string {
	const sections: string[] = [headerLine(labels.title, scope), '']
	if (labels.fieldLine) sections.push(labels.fieldLine, '')

	if (players.length === 0) {
		sections.push(labels.none)
	} else {
		for (const p of players) {
			sections.push(
				`- ${playerBits(p)} · ${pct(p.selectedByPercent)} · EO ${pct(p.eoByPercent)}`,
			)
		}
	}
	return withFooter(sections, labels.footer)
}

/** Captaincy board share text. */
export function formatCaptainShareText(
	players: TournamentStatPlayer[],
	scope: SelectionsShareScope,
	labels: SelectionsShareLabels,
): string {
	const sections: string[] = [headerLine(labels.title, scope), '']
	if (labels.fieldLine) sections.push(labels.fieldLine, '')

	if (players.length === 0) {
		sections.push(labels.none)
	} else {
		for (const p of players) {
			sections.push(
				`- ${playerBits(p)} · ${pct(p.captainByPercent)} · EO ${pct(p.eoByPercent)}`,
			)
		}
	}
	return withFooter(sections, labels.footer)
}

/** Transfer desk share text (in + out). */
export function formatTransferShareText(
	transferIn: TournamentStatPlayer[],
	transferOut: TournamentStatPlayer[],
	scope: SelectionsShareScope,
	labels: SelectionsShareLabels,
): string {
	const sections: string[] = [headerLine(labels.title, scope), '']
	if (labels.fieldLine) sections.push(labels.fieldLine, '')

	const inTitle = labels.transfersIn ?? 'In'
	const outTitle = labels.transfersOut ?? 'Out'

	sections.push(`${inTitle} (${transferIn.length})`)
	if (transferIn.length === 0) {
		sections.push(labels.none)
	} else {
		for (const p of transferIn) {
			sections.push(
				`- ${playerBits(p)} · ${count(p.transfersEvent)} · ${pct(p.selectedByPercent)}`,
			)
		}
	}

	sections.push('')
	sections.push(`${outTitle} (${transferOut.length})`)
	if (transferOut.length === 0) {
		sections.push(labels.none)
	} else {
		for (const p of transferOut) {
			sections.push(
				`- ${playerBits(p)} · ${count(p.transfersEvent)} · ${pct(p.selectedByPercent)}`,
			)
		}
	}

	return withFooter(sections, labels.footer)
}

export function buildSelectionsShareUrl(
	origin: string,
	localePathPrefix: string = '',
	selection?: {
		scope?: 'mine' | 'public' | null
		tournamentId?: number | null
		gameweek?: number | null
	},
): string {
	const base = origin.replace(/\/$/, '')
	const prefix = localePathPrefix.replace(/\/$/, '')
	const path = `${prefix}/explore/selections`
	const absolutePath = `${base}${path.startsWith('/') ? path : `/${path}`}`
	if (
		!selection?.scope ||
		!selection.tournamentId ||
		selection.tournamentId <= 0 ||
		!selection.gameweek ||
		selection.gameweek <= 0
	) {
		return absolutePath
	}
	const params = new URLSearchParams({
		scope: selection.scope,
		tournament: String(selection.tournamentId),
		gw: String(selection.gameweek),
	})
	return `${absolutePath}?${params.toString()}`
}
