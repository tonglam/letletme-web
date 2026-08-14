import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

const messageLoaders = {
	en: () => import('../messages/en.json').then(module => module.default),
	'zh-CN': () => import('../messages/zh-CN.json').then(module => module.default)
} satisfies Record<
	(typeof routing.locales)[number],
	() => Promise<IntlMessages>
>

export default getRequestConfig(async ({ requestLocale }) => {
	const requestedLocale = await requestLocale
	const locale = hasLocale(routing.locales, requestedLocale)
		? requestedLocale
		: routing.defaultLocale

	return {
		locale,
		messages: await messageLoaders[locale]()
	}
})
