import { defineRouting } from 'next-intl/routing'

export const LANGUAGE_COOKIE = {
	name: 'NEXT_LOCALE',
	maxAge: 60 * 60 * 24 * 365,
	sameSite: 'lax' as const,
}

export const routing = defineRouting({
	locales: ['en', 'zh-CN'],
	defaultLocale: 'en',
	localePrefix: 'as-needed',
	localeDetection: true,
	localeCookie: LANGUAGE_COOKIE,
})

export type AppLocale = (typeof routing.locales)[number]

export function isAppLocale(value: unknown): value is AppLocale {
	return typeof value === 'string' && routing.locales.includes(value as AppLocale)
}

export function localizePathname(pathname: string, locale: AppLocale): string {
	if (!pathname.startsWith('/')) return pathname
	if (locale === routing.defaultLocale) return pathname
	if (pathname === '/') return `/${locale}`
	return `/${locale}${pathname}`
}

export function getLocaleFromInternalPathname(pathname: string): AppLocale {
	const segment = pathname.split('/')[1]
	return isAppLocale(segment) ? segment : routing.defaultLocale
}

export function stripLocaleFromPathname(pathname: string): string {
	const locale = getLocaleFromInternalPathname(pathname)
	const prefix = `/${locale}`

	if (pathname === prefix) return '/'
	if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length)
	return pathname
}

export function localizeHref(href: string, locale: AppLocale): string {
	const suffixIndex = href.search(/[?#]/)
	const pathname = suffixIndex === -1 ? href : href.slice(0, suffixIndex)
	const suffix = suffixIndex === -1 ? '' : href.slice(suffixIndex)
	return `${localizePathname(pathname, locale)}${suffix}`
}

export function stripLocaleFromHref(href: string): string {
	const suffixIndex = href.search(/[?#]/)
	const pathname = suffixIndex === -1 ? href : href.slice(0, suffixIndex)
	const suffix = suffixIndex === -1 ? '' : href.slice(suffixIndex)
	return `${stripLocaleFromPathname(pathname)}${suffix}`
}
