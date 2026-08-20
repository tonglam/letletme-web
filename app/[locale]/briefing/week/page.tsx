import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { executePublicServerQuery } from '@/lib/graphql-server'
import { notFound } from 'next/navigation'
import { isBriefingPublicEnabled } from '@/lib/briefing-public'
import {
	GET_BRIEFING_WEEK,
	type BriefingLocaleVariable,
	type BriefingWeekResponse,
} from '@/lib/graphql/operations/briefing'
import { BriefingWeekView } from '@/components/briefing/BriefingWeekView'

export const dynamic = 'force-dynamic'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/briefing/week',
		titleKey: 'briefingTitle',
		descriptionKey: 'briefingDescription',
	})
}

export default async function BriefingWeekPage({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	if (!isBriefingPublicEnabled()) notFound()
	const graphqlLocale: BriefingLocaleVariable = locale === 'zh-CN' ? 'ZH_CN' : 'EN'
	let week: BriefingWeekResponse['briefingWeek'] = {
		state: 'UNAVAILABLE',
		revision: null,
		publicationId: null,
		publishedAt: null,
		sourceCheckedAt: null,
		staleAt: null,
		event: null,
		featured: [],
		sections: [],
	}

	try {
		const response = await executePublicServerQuery<BriefingWeekResponse>(
			'public-other',
			GET_BRIEFING_WEEK,
			{ locale: graphqlLocale },
			{ cache: 'no-store' },
		)
		week = response.briefingWeek
	} catch (error) {
		console.error('[briefing/week] failed to load publication:', error)
	}

	return <BriefingWeekView week={week} locale={locale} />
}
