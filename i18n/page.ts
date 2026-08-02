import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { localizedAlternates } from './config'
import { type AppLocale, routing } from './routing'

export type LocaleParams<T extends object = Record<string, never>> = Promise<
	T & { locale: string }
>

export async function getPageLocale<T extends object>(params: LocaleParams<T>) {
	const values = await params
	if (!hasLocale(routing.locales, values.locale)) notFound()
	setRequestLocale(values.locale)
	return { ...values, locale: values.locale as AppLocale }
}

export async function getPageMetadata({
	locale,
	pathname,
	titleKey,
	descriptionKey,
	noIndex = false,
}: {
	locale: AppLocale
	pathname: string
	titleKey: keyof IntlMessages['PageMetadata']
	descriptionKey?: keyof IntlMessages['PageMetadata']
	noIndex?: boolean
}): Promise<Metadata> {
	const t = await getTranslations({ locale, namespace: 'PageMetadata' })
	return {
		title: t(titleKey),
		...(descriptionKey ? { description: t(descriptionKey) } : {}),
		alternates: localizedAlternates(pathname, locale),
		...(noIndex ? { robots: { index: false, follow: false } } : {}),
	}
}
