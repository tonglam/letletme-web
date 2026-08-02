import { PageState } from '@/components/feedback/PageState'
import PageShell from '@/components/layout/PageShell'
import { getCurrentAndNextEvents } from '@/lib/events'
import { fetchOverallGameweekStats } from '@/lib/gameweek-overall-stats'
import { executePublicServerQuery } from '@/lib/graphql-server'
import { CalendarX2 } from 'lucide-react'
import GameweekStatsClient from '@/app/stats/gameweek/GameweekStatsClient'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { getTranslations } from 'next-intl/server'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/stats/gameweek',
		titleKey: 'gameweekStatsTitle',
		descriptionKey: 'gameweekStatsDescription',
	})
}

export default async function GameweekStatsPage({ params }: PageProps) {
	await getPageLocale(params)
	const t = await getTranslations('States')
	const data = await getCurrentAndNextEvents()
	const currentGameweek = data?.current[0]?.id

	if (!currentGameweek) {
		return (
			<PageShell>
				<PageState
					icon={CalendarX2}
					title={t('gameweekUnavailableTitle')}
					description={t('gameweekUnavailableDescription')}
				/>
			</PageShell>
		)
	}

	let initialOverallStats: Awaited<ReturnType<typeof fetchOverallGameweekStats>> | null = null

	try {
		initialOverallStats = await fetchOverallGameweekStats(currentGameweek, {
			cache: 'force-cache',
			next: { revalidate: 300 },
		}, executePublicServerQuery)
	} catch (err) {
		console.error('Failed to load initial gameweek overview:', err)
	}

	return (
		<GameweekStatsClient
			currentGameweek={currentGameweek}
			initialOverallStats={initialOverallStats}
		/>
	)
}
