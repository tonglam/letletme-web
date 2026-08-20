import { LiveMatchesEntry } from '@/app/live/matches/LiveMatchesEntry'
import { SeasonPhaseState } from '@/components/feedback/SeasonPhaseState'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { executePublicServerQuery } from '@/lib/graphql-server'
import { getLiveMatchesSnapshot } from '@/lib/live-matches'
import { getLivePageContext } from '@/lib/live-context-server'
import { getTranslations } from 'next-intl/server'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/live/matches',
		titleKey: 'liveMatchesTitle',
		descriptionKey: 'liveMatchesDescription'
	})
}

export default async function LiveMatchesPage({ params }: PageProps) {
	await getPageLocale(params)
	const t = await getTranslations('States')

	// The shared lifecycle context is the single public gate for current and
	// next event identity. The match desk then reads the same revision directly
	// in RSC, avoiding a second event query or self-HTTP hop.
	const { presentation, liveContext } = await getLivePageContext()
	if (
		presentation.phase === 'PRESEASON' ||
		presentation.phase === 'BETWEEN_GAMEWEEKS' ||
		presentation.phase === 'OFFSEASON' ||
		presentation.phase === 'UNAVAILABLE'
	) {
		return <SeasonPhaseState feature="matches" presentation={presentation} />
	}

	const currentEventId = presentation.currentEventId
	if (!currentEventId) {
		return <SeasonPhaseState feature="matches" presentation={presentation} />
	}
	const nextEventId = presentation.nextEventId

	let matches: Awaited<ReturnType<typeof getLiveMatchesSnapshot>>['matches'] =
		[]
	let snapshot: Awaited<ReturnType<typeof getLiveMatchesSnapshot>>['snapshot'] =
		null
	let renderedCurrentEventId = currentEventId
	let renderedNextEventId = nextEventId
	let initialError: string | null = null

	try {
		const live = await getLiveMatchesSnapshot(
			nextEventId,
			(query, variables, options) =>
				executePublicServerQuery('gameweek', query, variables, options),
			currentEventId,
			{ revision: liveContext?.revision }
		)
		matches = live.matches
		snapshot = live.snapshot
		renderedCurrentEventId = live.currentEventId ?? currentEventId
		renderedNextEventId = live.nextEventId
		if (snapshot?.eventId != null && snapshot.eventId !== currentEventId) {
			console.warn(
				'[live/matches] liveSnapshot.eventId differs from isCurrent',
				{ snapshotEventId: snapshot.eventId, currentEventId }
			)
		}
	} catch (error) {
		console.error('Failed to fetch live matches:', error)
		initialError = t('matchesFailed')
	}

	return (
		<LiveMatchesEntry
			initialMatches={matches}
			initialError={initialError}
			currentEventId={renderedCurrentEventId}
			nextEventId={renderedNextEventId ?? undefined}
			initialSnapshot={snapshot}
		/>
	)
}
