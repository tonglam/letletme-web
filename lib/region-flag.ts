const REGION_ALIASES: Record<string, string> = {
	england: 'GB',
	'great britain': 'GB',
	'northern ireland': 'GB',
	scotland: 'GB',
	uk: 'GB',
	wales: 'GB',
	'czech republic': 'CZ',
	netherlands: 'NL',
	'south korea': 'KR',
	turkey: 'TR',
	usa: 'US',
	'united states of america': 'US'
}

const REGION_CODE_PATTERN = /^[A-Z]{2}$/

function normalizeRegion(region: string): string {
	return region.trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ')
}

function buildRegionNameMap(): Map<string, string> {
	if (typeof Intl.DisplayNames !== 'function') return new Map()

	const displayNames = new Intl.DisplayNames(['en'], { type: 'region' })
	const map = new Map<string, string>()
	for (let first = 65; first <= 90; first += 1) {
		for (let second = 65; second <= 90; second += 1) {
			const code = String.fromCharCode(first, second)
			const name = displayNames.of(code)
			if (!name || name === code || name === 'Unknown Region') continue
			map.set(normalizeRegion(name), code)
		}
	}
	return map
}

const REGION_NAME_TO_CODE = buildRegionNameMap()

/** Converts an FPL region code or country name into a Unicode flag emoji. */
export function regionToFlagEmoji(
	region: string | null | undefined
): string | null {
	if (!region?.trim()) return null

	const rawRegion = region.trim()
	const normalized = normalizeRegion(rawRegion)
	const directCode = rawRegion.toUpperCase()
	const code = REGION_CODE_PATTERN.test(directCode)
		? directCode
		: REGION_ALIASES[normalized] || REGION_NAME_TO_CODE.get(normalized)

	if (!code || !REGION_CODE_PATTERN.test(code)) return null

	return String.fromCodePoint(
		...code.split('').map(char => 0x1f1e6 + char.charCodeAt(0) - 65)
	)
}
