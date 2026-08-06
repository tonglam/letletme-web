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
	titleValues,
	descriptionKey,
	descriptionValues,
	noIndex = false,
}: {
	locale: AppLocale
	pathname: string
	titleKey: keyof IntlMessages['PageMetadata']
	/** ICU message values for titleKey (e.g. { id } for "Points — {id}"). */
	titleValues?: Record<string, string | number>
	descriptionKey?: keyof IntlMessages['PageMetadata']
	descriptionValues?: Record<string, string | number>
	noIndex?: boolean
}): Promise<Metadata> {
	const t = await getTranslations({ locale, namespace: 'PageMetadata' })
	return {
		title: titleValues ? t(titleKey, titleValues) : t(titleKey),
		...(descriptionKey
			? {
					description: descriptionValues
						? t(descriptionKey, descriptionValues)
						: t(descriptionKey),
				}
			: {}),
		alternates: localizedAlternates(pathname, locale),
		...(noIndex ? { robots: { index: false, follow: false } } : {}),
	}
}
