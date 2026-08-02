import { APP_URL, PUBLIC_STATIC_PATHS } from '@/i18n/config'
import { localizePathname, routing } from '@/i18n/routing'
import type { MetadataRoute } from 'next'

function absoluteUrl(pathname: string) {
	return new URL(pathname, APP_URL).toString()
}

export default function sitemap(): MetadataRoute.Sitemap {
	return PUBLIC_STATIC_PATHS.flatMap(pathname => {
		const languages = {
			en: absoluteUrl(localizePathname(pathname, 'en')),
			'zh-CN': absoluteUrl(localizePathname(pathname, 'zh-CN')),
			'x-default': absoluteUrl(localizePathname(pathname, routing.defaultLocale)),
		}

		return routing.locales.map(locale => ({
			url: absoluteUrl(localizePathname(pathname, locale)),
			changeFrequency: pathname === '/' ? 'hourly' as const : 'daily' as const,
			priority: pathname === '/' ? 1 : 0.8,
			alternates: { languages },
		}))
	})
}
