export const PLAYER_STATS_PATH = '/data/player-stats'

export type PlayerStatsSectionId =
	| 'fixtures'
	| 'recent'
	| 'season'
	| 'process'
	| 'history'
	| 'market'
	| 'coverage'

export const PLAYER_STATS_SECTION_IDS: PlayerStatsSectionId[] = [
	'fixtures',
	'recent',
	'season',
	'process'
]

export function parsePlayerStatsPlayerId(
	value: string | null | undefined
): number | null {
	const n = Number(value)
	if (!Number.isInteger(n) || n <= 0) return null
	return n
}

export function playerStatsSectionFromHash(
	hash: string | null | undefined
): PlayerStatsSectionId | null {
	const raw = (hash ?? '').replace(/^#/, '').trim()
	if (!raw) return null
	if (raw === 'ps-fixtures') return 'fixtures'
	if (raw === 'ps-recent') return 'recent'
	if (raw === 'ps-season') return 'season'
	if (raw === 'ps-process') return 'process'
	if (raw === 'ps-history') return 'history'
	if (raw === 'ps-market') return 'market'
	if (raw === 'ps-coverage') return 'coverage'
	return null
}

export function playerStatsSectionHash(section: PlayerStatsSectionId): string {
	return `#ps-${section}`
}

export function buildPlayerStatsQueryString(opts: {
	p1?: string | null
	p2?: string | null
}): string {
	const params = new URLSearchParams()
	const p1 = opts.p1?.trim()
	const p2 = opts.p2?.trim()
	if (p1) params.set('p1', p1)
	if (p1 && p2 && p2 !== p1) params.set('p2', p2)
	return params.toString()
}

export function playerStatsHref(opts: {
	p1?: string | null
	p2?: string | null
	section?: PlayerStatsSectionId | null
	localePathPrefix?: string
}): string {
	const prefix = (opts.localePathPrefix ?? '').replace(/\/$/, '')
	const base = `${prefix}${PLAYER_STATS_PATH}`
	const q = buildPlayerStatsQueryString({ p1: opts.p1, p2: opts.p2 })
	const hash = opts.section ? playerStatsSectionHash(opts.section) : ''
	return q ? `${base}?${q}${hash}` : `${base}${hash}`
}
