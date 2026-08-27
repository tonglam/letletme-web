import { getPageLocale, type LocaleParams } from '@/i18n/page'
import { localizePathname } from '@/i18n/routing'
import { permanentRedirect } from 'next/navigation'

/**
 * Keep existing bookmarks and shared links working after the public route was
 * renamed from price-changes to price-predictions.
 */
export default async function LegacyPriceChangesPage({
	params
}: {
	params: LocaleParams
}) {
	const { locale } = await getPageLocale(params)
	permanentRedirect(localizePathname('/explore/price-predictions', locale))
}
