import { type AppLocale, isAppLocale } from './routing'

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

	return request.headers.get('accept-language')?.toLowerCase().includes('zh')
		? 'zh-CN'
		: 'en'
}
