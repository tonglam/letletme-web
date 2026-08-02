import { APP_URL } from '@/i18n/config'
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: '*',
			allow: '/',
			disallow: ['/api/'],
		},
		sitemap: new URL('/sitemap.xml', APP_URL).toString(),
		host: APP_URL.origin,
	}
}
