import type { Fixture } from '@/lib/graphql/operations/events'
import {
	filterFixtures,
	formatFixtureTime,
	groupFixturesByDay,
	type FixtureFilter
} from '@/lib/fixtures-desk'
import {
	formatAvgFdr,
	type FdrReviewBuckets,
	type FdrReviewCandidate,
	type SquadFdrRow
} from '@/lib/fixtures-fdr'

export type FixturesShareLabels = {
	title: string
	none: string
	footer?: string
	live?: string
}

export function formatFixturesShareText(opts: {
	gameweek: number
	fixtures: Fixture[]
	filter?: FixtureFilter
	useLocalTime?: boolean
	locale?: string
	labels: FixturesShareLabels
}): string {
	const {
		gameweek,
		fixtures,
		filter = 'all',
		useLocalTime = true,
		locale = 'en',
		labels
	} = opts

	const filtered = filterFixtures(fixtures, filter)
	const groups = groupFixturesByDay(filtered, { useLocalTime, locale })
	const sections: string[] = [`${labels.title} · GW${gameweek}`, '']

	if (groups.length === 0) {
		sections.push(labels.none)
	} else {
		for (const group of groups) {
			sections.push(group.shortLabel)
			for (const f of group.fixtures) {
				const home = f.homeTeam?.shortName ?? f.homeTeam?.name ?? '?'
				const away = f.awayTeam?.shortName ?? f.awayTeam?.name ?? '?'
				let result: string
				if (f.finished) {
					const hs = f.homeScore ?? '—'
					const as = f.awayScore ?? '—'
					result = `${hs}–${as}`
				} else if (f.started) {
					const hs = f.homeScore
					const as = f.awayScore
					const score = hs != null && as != null ? ` ${hs}–${as}` : ''
					result = `${labels.live ?? 'LIVE'}${score}`
				} else if (f.kickoffTime) {
					result = formatFixtureTime(
						new Date(f.kickoffTime),
						useLocalTime,
						locale
					)
				} else {
					result = '—'
				}
				sections.push(`- ${home} vs ${away} · ${result}`)
			}
			sections.push('')
		}
		if (sections[sections.length - 1] === '') sections.pop()
	}

	if (labels.footer?.trim()) {
		sections.push('', labels.footer.trim())
	}
	return sections.join('\n')
}

function cellLabel(c: SquadFdrRow['run'][number]): string {
	const ha = c.wasHome ? 'H' : 'A'
	return c.opponentShortName + ' ' + ha + '(' + String(c.difficulty) + ')'
}

function gameweekLabel(gameweek: SquadFdrRow['gameweeks'][number]): string {
	if (gameweek.bgw) return 'GW' + String(gameweek.eventId) + ': BGW'
	return (
		'GW' +
		String(gameweek.eventId) +
		': ' +
		gameweek.fixtures.map(cellLabel).join(' + ')
	)
}

function formatCandidateLine(p: FdrReviewCandidate): string {
	const next =
		p.nextOpponent != null ? `${p.nextOpponent} ${p.nextHome ? 'H' : 'A'}` : '—'
	const price = `£${(p.price / 10).toFixed(1)}m`
	return `- ${p.webName} ${p.teamShortNameResolved} · ${price} · ${p.selectedByPercent.toFixed(1)}% · FDR ${formatAvgFdr(p.avgFdr)} · next ${next}`
}

export function formatFdrCandidatesShareText(opts: {
	fromGw: number
	horizon: number
	buckets: FdrReviewBuckets
	labels: {
		title: string
		popularFavourable: string
		differentialFavourable: string
		popularDifficult: string
		none: string
		footer?: string
	}
}): string {
	const { fromGw, horizon, buckets, labels } = opts
	const lines = [`${labels.title} · GW${fromGw}–${fromGw + horizon - 1}`, '']

	const section = (name: string, list: FdrReviewCandidate[]) => {
		lines.push(`${name} (${list.length})`)
		if (list.length === 0) lines.push(labels.none)
		else for (const p of list) lines.push(formatCandidateLine(p))
		lines.push('')
	}

	section(labels.differentialFavourable, buckets.differentialFavourable)
	section(labels.popularFavourable, buckets.popularFavourable)
	section(labels.popularDifficult, buckets.popularDifficult)
	if (lines[lines.length - 1] === '') lines.pop()
	if (labels.footer?.trim()) lines.push('', labels.footer.trim())
	return lines.join('\n')
}

export function formatMySquadShareText(opts: {
	fromGw: number
	horizon: number
	rows: SquadFdrRow[]
	labels: {
		title: string
		none: string
		footer?: string
	}
}): string {
	const { fromGw, horizon, rows, labels } = opts
	const lines = [`${labels.title} · GW${fromGw}–${fromGw + horizon - 1}`, '']
	if (rows.length === 0) {
		lines.push(labels.none)
	} else {
		for (const row of rows) {
			const run = row.gameweeks.map(gameweekLabel).join(' · ')
			lines.push(
				`- ${row.webName} ${row.teamShortName} · ${row.positionCode} · avg ${formatAvgFdr(row.avgFdr)} · ${run}`
			)
		}
	}
	if (labels.footer?.trim()) lines.push('', labels.footer.trim())
	return lines.join('\n')
}

export function buildFixturesShareUrl(
	origin: string,
	localePathPrefix: string = ''
): string {
	const base = origin.replace(/\/$/, '')
	const prefix = localePathPrefix.replace(/\/$/, '')
	const path = `${prefix}/explore/fixtures`
	return `${base}${path.startsWith('/') ? path : `/${path}`}`
}
