import { PageState } from '@/components/feedback/PageState'
import { SeasonPhaseRetry } from '@/components/feedback/SeasonPhaseRetry'
import { Link } from '@/i18n/navigation'
import type {
	SeasonPresentation,
	SeasonPresentationPhase,
} from '@/lib/season-presentation'
import { CalendarX2 } from 'lucide-react'
import { getFormatter, getTranslations } from 'next-intl/server'

type LiveFeature = 'points' | 'competition' | 'matches'

const featureDescriptionKeys = {
	points: {
		preseason: 'preseasonPointsDescription',
		preDeadline: 'preDeadlinePointsDescription',
	},
	competition: {
		preseason: 'preseasonCompetitionDescription',
		preDeadline: 'preDeadlineCompetitionDescription',
	},
	matches: {
		preseason: 'preseasonMatchesDescription',
		preDeadline: 'preDeadlineMatchesDescription',
	},
} as const

function gameweekFor(
	presentation: SeasonPresentation,
	phase: SeasonPresentationPhase,
): number | null {
	if (phase === 'PRESEASON' || phase === 'PRE_DEADLINE') {
		return presentation.currentEventId ?? presentation.nextEventId
	}
	return presentation.nextEventId ?? presentation.latestFinishedEventId
}

export async function SeasonPhaseState({
	presentation,
	feature,
}: {
	presentation: SeasonPresentation
	feature: LiveFeature
}) {
	const t = await getTranslations('SeasonState')
	const format = await getFormatter()
	const gameweek = gameweekFor(presentation, presentation.phase) ?? 1
	const deadline = presentation.nextDeadlineTime
	const deadlineDate = deadline ? new Date(deadline) : null
	const deadlineLabel = deadlineDate && !Number.isNaN(deadlineDate.getTime())
		? format.dateTime(deadlineDate, {
				dateStyle: 'medium',
				timeStyle: 'short',
			})
		: null

	if (presentation.phase === 'UNAVAILABLE') {
		return (
			<PageState
				icon={CalendarX2}
				title={t('unavailableTitle')}
				description={t('unavailableDescription')}
				actions={<SeasonPhaseRetry />}
				role="alert"
			/>
		)
	}

	if (presentation.phase === 'OFFSEASON') {
		return (
			<PageState
				icon={CalendarX2}
				title={t('offseasonTitle')}
				description={t('offseasonDescription')}
				actions={
					<Link className="underline underline-offset-4" href="/explore/market">
						{t('viewMarket')}
					</Link>
				}
			/>
		)
	}

	if (presentation.phase === 'BETWEEN_GAMEWEEKS') {
		return (
			<PageState
				icon={CalendarX2}
				title={t('betweenTitle')}
				description={t('betweenDescription', {
					nextGameweek: presentation.nextEventId ?? gameweek,
				})}
				actions={
					<>
						<Link className="underline underline-offset-4" href="/explore/fixtures">
							{t('viewFixtures')}
						</Link>
						<Link className="underline underline-offset-4" href="/explore/market">
							{t('viewMarket')}
						</Link>
					</>
				}
			/>
		)
	}

	const featureDescriptionKey =
		presentation.phase === 'PRESEASON'
			? featureDescriptionKeys[feature].preseason
			: featureDescriptionKeys[feature].preDeadline
	const featureDescription = t(featureDescriptionKey, {
		gameweek,
		deadline: deadlineLabel ?? t('notPublished'),
	})
	const fixtureAction =
		presentation.phase === 'PRESEASON'
			? t('viewFixturesForGameweek', { gameweek })
			: t('viewFixtures')
	const marketAction =
		presentation.phase === 'PRESEASON'
			? t('viewPreseasonMarket')
			: t('viewMarket')

	return (
		<PageState
			icon={CalendarX2}
			title={t(
				presentation.phase === 'PRESEASON'
					? 'preseasonTitle'
					: 'preDeadlineTitle',
				{ gameweek },
			)}
			description={featureDescription}
			actions={
				<>
					<Link className="underline underline-offset-4" href="/explore/fixtures">
						{fixtureAction}
					</Link>
					<Link className="underline underline-offset-4" href="/explore/market">
						{marketAction}
					</Link>
				</>
			}
		/>
	)
}
