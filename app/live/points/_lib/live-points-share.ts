import type { LiveCalcData } from '@/lib/graphql/operations/live'
import { traceableLiveScore } from '@/lib/live-score-v2'
export {
	copyElementImageToClipboard,
	copyTextToClipboard,
	shareElementImage,
	shareImageBlob,
	shareText,
	shouldIncludeShareImageNode,
	type ClipboardCopyResult,
	type ShareResult
} from '@/lib/share/clipboard'
import { formatChipName } from '@/lib/utils'
import type { Player } from '@/types/player'

export type LivePointsShareLabels = {
	/** e.g. "Live" / "实时" */
	live: string
	/** e.g. "Net" / "净分" */
	net: string
	/** e.g. "Season" / "赛季" */
	season: string
	/** e.g. "Chip" / "道具" */
	chip: string
	/** When no chip is active */
	noChip: string
	/** e.g. "C" / "队长" */
	captain: string
	/** e.g. "Starting XI" / "首发" */
	startingXi: string
	/** e.g. "Bench" / "替补" */
	bench: string
	statusPlaying: string
	statusFinished: string
	statusNotStarted: string
	/** Short pts unit, e.g. "pts" / "分" */
	pts: string
	/** Hits label, e.g. "hits" / "转会扣分" */
	hits: string
	/**
	 * Optional footer line already localized (may include the entry live-points URL).
	 * Prefer `formatShareFooter(label, url)` so the link always targets this team.
	 */
	footer?: string
}

export type FormatLivePointsShareInput = {
	gameweek: number
	liveData: Pick<
		LiveCalcData,
		| 'entryName'
		| 'entry'
		| 'playerName'
		| 'score'
		| 'chip'
		| 'captainName'
	>
	startingPlayers: Player[]
	benchPlayers: Player[]
	labels: LivePointsShareLabels
}

/** Absolute URL to an entry's live points page, e.g. https://letletme.top/live/points/6953 */
export function buildLivePointsEntryShareUrl(
	entryId: number,
	origin: string,
	localePathPrefix: string = ''
): string {
	const base = origin.replace(/\/$/, '')
	const prefix = localePathPrefix.replace(/\/$/, '')
	const path = `${prefix}/live/points/${entryId}`
	return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

/** e.g. label "Live points: {url}" + url → "Live points: https://…" */
export function formatShareFooter(template: string, url: string): string {
	if (template.includes('{url}')) return template.replaceAll('{url}', url)
	return `${template} ${url}`.trim()
}

function statusLabel(
	status: Player['playingStatus'],
	labels: LivePointsShareLabels
): string {
	switch (status) {
		case 'PLAYING':
			return labels.statusPlaying
		case 'FINISHED':
			return labels.statusFinished
		default:
			return labels.statusNotStarted
	}
}

function formatChip(
	chip: string | null | undefined,
	labels: LivePointsShareLabels
): string {
	if (!chip || chip.trim() === '') return labels.noChip
	const formatted = formatChipName(chip)
	return formatted === 'Unknown' ? labels.noChip : formatted
}

function formatPlayerLine(
	player: Player,
	labels: LivePointsShareLabels
): string {
	const role = player.isCaptain ? ' (C)' : player.isViceCaptain ? ' (V)' : ''
	const pts = player.stats.points
	const status = statusLabel(player.playingStatus, labels)
	// Compact md-ish bullet: position · club · name · status · pts
	return `- ${player.position} ${player.teamShort} ${player.name}${role} · ${status} · ${pts}${labels.pts ? ` ${labels.pts}` : ''}`
}

/**
 * Build a plain-text / markdown-ish live points summary for social sharing.
 * Intentionally compact — no xG, ownership, or event breakdown clutter.
 */
export function formatLivePointsShareText({
	gameweek,
	liveData,
	startingPlayers,
	benchPlayers,
	labels
}: FormatLivePointsShareInput): string {
	const teamName =
		liveData.entryName?.trim() ||
		(liveData.entry ? `Entry ${liveData.entry}` : 'FPL Team')
	const manager = liveData.playerName?.trim()
	const chip = formatChip(liveData.chip, labels)
	const score = traceableLiveScore(liveData.score)
	const transferCost = score?.transferCost ?? null
	const hitsPart =
		transferCost != null && transferCost > 0
			? ` (−${transferCost} ${labels.hits})`
			: ''
	const netPoints = score?.netEventPoints ?? null
	const eventPoints = score?.eventPoints ?? null
	const totalPoints = score?.totalScope === 'OVERALL' ? score.totalPoints : null
	const netText = netPoints == null ? '—' : String(netPoints)
	const captainName =
		[...startingPlayers, ...benchPlayers].find(player => player.isCaptain)
			?.name ?? liveData.captainName

	const header = [
		`# ${teamName} · GW${gameweek}`,
		manager ? manager : null,
		`${labels.live}: **${eventPoints == null ? '—' : eventPoints}**${hitsPart} · ${labels.net}: ${netText} · ${labels.season}: ${totalPoints == null ? '—' : totalPoints}`,
		`${labels.chip}: ${chip} · ${labels.captain}: ${captainName || '—'}`
	]
		.filter(Boolean)
		.join('\n')

	const xiLines = startingPlayers.map(p => formatPlayerLine(p, labels))
	const benchLines = benchPlayers.map(p => formatPlayerLine(p, labels))

	const sections = [header, '', `## ${labels.startingXi}`, ...xiLines]

	if (benchLines.length > 0) {
		sections.push('', `## ${labels.bench}`, ...benchLines)
	}

	if (labels.footer) {
		sections.push('', labels.footer)
	}

	return sections.join('\n')
}
