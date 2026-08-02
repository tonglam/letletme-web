import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_PLAYER_VALUES,
	type PlayerValue,
	type PlayerValuesResponse,
} from '@/lib/graphql/operations/prices'
import {
	utcCalendarDateISO,
} from '@/lib/graphql/operations/events'
import PriceChangesClient from '@/app/data/price-changes/PriceChangesClient'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { getTranslations } from 'next-intl/server'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/data/price-changes',
		titleKey: 'priceChangesTitle',
		descriptionKey: 'priceChangesDescription',
	})
}

export default async function PriceChangesPage({ params }: PageProps) {
	await getPageLocale(params)
	const t = await getTranslations('States')
	let initialPlayerValues: PlayerValue[] | null = null
	let initialError: string | null = null
	try {
		const data = await executePublicServerQuery<PlayerValuesResponse>(
			GET_PLAYER_VALUES,
			{ changeDate: utcCalendarDateISO() },
			{ cache: 'force-cache', next: { revalidate: 3600 } },
		)
		initialPlayerValues = data.playerValues
	} catch (err) {
		console.error('[price-changes] RSC fetch failed:', err)
		initialError = t('priceChangesUnavailable')
	}
	return (
		<PriceChangesClient
			initialPlayerValues={initialPlayerValues}
			initialError={initialError}
		/>
	)
}
