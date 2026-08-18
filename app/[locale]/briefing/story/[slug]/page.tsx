import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { executePublicServerQuery } from '@/lib/graphql-server'
import { notFound } from 'next/navigation'
import { isBriefingPublicEnabled } from '@/lib/briefing-public'
import {
	GET_BRIEFING_STORY,
	type BriefingLocaleVariable,
	type BriefingStoryResponse,
} from '@/lib/graphql/operations/briefing'
import { BriefingStoryView } from '@/components/briefing/BriefingStoryView'

export const dynamic = 'force-dynamic'

type PageProps = { params: LocaleParams<{ slug: string }> }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/briefing/story',
		titleKey: 'briefingStoryTitle',
		descriptionKey: 'briefingStoryDescription',
	})
}

export default async function BriefingStoryPage({ params }: PageProps) {
	const { locale, slug } = await getPageLocale(params)
	if (!isBriefingPublicEnabled()) notFound()
	const graphqlLocale: BriefingLocaleVariable = locale === 'zh-CN' ? 'ZH_CN' : 'EN'
	let result: BriefingStoryResponse = { briefingStory: null }

	try {
		result = await executePublicServerQuery<BriefingStoryResponse>(
			GET_BRIEFING_STORY,
			{ slug, locale: graphqlLocale },
			{ cache: 'no-store' },
		)
	} catch (error) {
		console.error('[briefing/story] failed to load publication:', error)
	}

	return <BriefingStoryView result={result} locale={locale} />
}
