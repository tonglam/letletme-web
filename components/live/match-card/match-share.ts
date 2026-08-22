import type { Match } from '@/types/match'
import { buildMatchHighlights } from './match-card-model'

export type MatchShareLabels = {
	liveMinute: (minute: number) => string
	halfTime: string
	fullTime: string
	notStarted: string
	upcoming: string
	goals: string
	assists: string
	bonusPoints: string
	bps: string
	defensiveContribution: string
	saves: string
	yellowCards: string
	redCards: string
	footer?: string
}

function statusLine(match: Match, labels: MatchShareLabels): string {
	switch (match.status) {
		case 'LIVE':
			return labels.liveMinute(match.minute)
		case 'HT':
			return labels.halfTime
		case 'FT':
			return labels.fullTime
		case 'NOT_STARTED':
			return labels.notStarted
		case 'UPCOMING':
			return labels.upcoming
		default:
			return match.status
	}
}

function groupTitle(
	kind: string,
	labels: MatchShareLabels,
): string {
	switch (kind) {
		case 'goals':
			return labels.goals
		case 'assists':
			return labels.assists
		case 'bonus':
			return labels.bonusPoints
		case 'bps':
			return labels.bps
		case 'defensive':
			return labels.defensiveContribution
		case 'saves':
			return labels.saves
		case 'yellow':
			return labels.yellowCards
		case 'red':
			return labels.redCards
		default:
			return kind
	}
}

/**
 * Plain-text match summary for social paste (compact, markdown-ish).
 * Highlights only — no player list / points table.
 */
export function formatMatchShareText(
	match: Match,
	labels: MatchShareLabels,
): string {
	const header = `${match.homeTeam.shortName} ${match.homeTeam.score} – ${match.awayTeam.score} ${match.awayTeam.shortName} · ${statusLine(match, labels)}`
	const sections: string[] = [header]

	const highlights = buildMatchHighlights(match)
	// Share order: goals, assists, bonus, cards first — skip long BPS dumps if needed
	const shareKinds = [
		'goals',
		'assists',
		'bonus',
		'saves',
		'defensive',
		'yellow',
		'red',
		'bps',
	] as const
	const byKind = new Map(highlights.map(g => [g.kind, g]))

	for (const kind of shareKinds) {
		const group = byKind.get(kind)
		if (!group || group.items.length === 0) continue
		// Cap BPS list for share length
		const items =
			kind === 'bps' ? group.items.slice(0, 3) : group.items
		sections.push('')
		sections.push(groupTitle(kind, labels))
		for (const item of items) {
			const value =
				kind === 'bonus' ? `+${item.value}` : String(item.value)
			sections.push(`- ${item.player} (${item.team}) ${value}`)
		}
	}

	if (labels.footer) {
		sections.push('')
		sections.push(labels.footer)
	}

	return sections.join('\n')
}
