import { type AppLocale, isAppLocale, routing } from './routing'

type LanguageRange = {
	range: string
	quality: number
	order: number
}

const SUPPORTED_LOCALES: AppLocale[] = [...routing.locales]

function rangeMatchesLocale(range: string, locale: AppLocale): boolean {
	const language = locale.toLowerCase().split('-')[0]
	return range === language || range.startsWith(`${language}-`)
}

export function getLocaleFromAcceptLanguage(header: string | null): AppLocale | undefined {
	if (!header) return undefined

	const ranges = header.split(',').map((part, order): LanguageRange => {
		const [rawRange = '', ...parameters] = part.split(';')
		const qualityParameter = parameters.find(parameter => /^\s*q\s*=/i.test(parameter))
		const parsedQuality = qualityParameter
			? Number(qualityParameter.split('=')[1]?.trim())
			: 1
		const quality = Number.isFinite(parsedQuality) && parsedQuality >= 0 && parsedQuality <= 1
			? parsedQuality
			: 0
		return { range: rawRange.trim().toLowerCase(), quality, order }
	})

	const wildcardRanges = ranges.filter(({ range }) => range === '*')
	const preferences = SUPPORTED_LOCALES.map(locale => {
		const explicitRanges = ranges.filter(({ range }) => rangeMatchesLocale(range, locale))
		const candidates = explicitRanges.length > 0 ? explicitRanges : wildcardRanges
		const best = candidates.sort((a, b) => b.quality - a.quality || a.order - b.order)[0]
		return best ? { locale, quality: best.quality, order: best.order } : null
	}).filter((preference): preference is { locale: AppLocale; quality: number; order: number } => (
		Boolean(preference && preference.quality > 0)
	))

	return preferences.sort((a, b) => b.quality - a.quality || a.order - b.order)[0]?.locale
}

export function getRequestLocale(request?: Request): AppLocale {
	if (!request) return 'en'

	const cookie = request.headers
		.get('cookie')
		?.split(';')
		.map(part => part.trim().split('='))
		.find(([name]) => name === 'NEXT_LOCALE')?.[1]
	let decodedCookie: string | undefined
	if (cookie) {
		try {
			decodedCookie = decodeURIComponent(cookie)
		} catch {}
	}
	if (isAppLocale(decodedCookie)) return decodedCookie

	const referer = request.headers.get('referer')
	if (referer) {
		try {
			const segment = new URL(referer).pathname.split('/')[1]
			if (isAppLocale(segment)) return segment
		} catch {}
	}

	return getLocaleFromAcceptLanguage(request.headers.get('accept-language')) ?? 'en'
}
