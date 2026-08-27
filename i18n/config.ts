import type { Metadata } from 'next'
import type { AppLocale } from './routing'
import { localizePathname, routing } from './routing'

export const APP_URL = new URL(
	process.env.NEXT_PUBLIC_APP_URL ??
		process.env.BETTER_AUTH_URL ??
		'https://letletme.top',
)

export const PUBLIC_STATIC_PATHS = [
	'/',
	'/live/matches',
	'/explore/player-stats',
	'/explore/market',
	'/explore/price-predictions',
	'/explore/gameweek',
	'/explore/fixtures',
] as const

export function localizedAlternates(
	pathname: string,
	locale: AppLocale,
): NonNullable<Metadata['alternates']> {
	return {
		canonical: localizePathname(pathname, locale),
		languages: {
			en: localizePathname(pathname, 'en'),
			'zh-CN': localizePathname(pathname, 'zh-CN'),
			'x-default': localizePathname(pathname, routing.defaultLocale),
		},
	}
}
