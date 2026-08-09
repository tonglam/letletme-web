import GameweekStatsClient from '@/app/data/gameweek/GameweekStatsClient'
import { CurrentGameweekUnavailable } from '@/components/feedback/CurrentGameweekUnavailable'
import { CacheTag, RevalidateSeconds } from '@/lib/cache-policy'
import { getCurrentAndNextEvents } from '@/lib/events'
import { fetchOverallGameweekStats } from '@/lib/gameweek-overall-stats'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	isPreseasonReviewAnchor,
	resolveReviewGameweekAnchor,
} from '@/lib/review-gameweek'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/data/gameweek',
		titleKey: 'gameweekStatsTitle',
		descriptionKey: 'gameweekStatsDescription',
	})
}

export default async function GameweekStatsPage({ params }: PageProps) {
	await getPageLocale(params)

	const events = await getCurrentAndNextEvents()
	if (events == null) return <CurrentGameweekUnavailable />

	const review = resolveReviewGameweekAnchor(events)
	const anchorGameweek = review.anchorGw
	if (anchorGameweek == null) return <CurrentGameweekUnavailable />
	const preseason = isPreseasonReviewAnchor(review)

	let initialOverallStats: Awaited<
		ReturnType<typeof fetchOverallGameweekStats>
	> | null = null

	if (!preseason) {
		try {
			initialOverallStats = await fetchOverallGameweekStats(
				anchorGameweek,
				{
					cache: 'force-cache',
					next: {
						revalidate: RevalidateSeconds.publicStats,
						tags: [CacheTag.gameweekStats, CacheTag.events],
					},
				},
				executePublicServerQuery,
			)
		} catch (err) {
			console.error('Failed to load initial gameweek overview:', err)
		}
	}

	return (
		<GameweekStatsClient
			anchorGameweek={anchorGameweek}
			currentGameweek={review.currentGw}
			preseason={preseason}
			initialOverallStats={initialOverallStats}
		/>
	)
}
