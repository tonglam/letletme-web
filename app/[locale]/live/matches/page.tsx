import { LiveMatchesClient } from '@/app/live/matches/LiveMatchesClient'
import { CurrentGameweekUnavailable } from '@/components/feedback/CurrentGameweekUnavailable'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { getCurrentAndNextEvents, pickCurrentEventId } from '@/lib/events'
import { executePublicServerQuery } from '@/lib/graphql-server'
import { getLiveMatchesSnapshot } from '@/lib/live-matches'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

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

	// Gate first — route loading.tsx is GatedRouteLoading, not full match UI.
	const events = await getCurrentAndNextEvents()
	const currentEventId = pickCurrentEventId(events)
	if (!currentEventId) {
		return <CurrentGameweekUnavailable />
	}
	const nextEventCandidate = events?.next?.[0]?.id
	const nextEventId =
		typeof nextEventCandidate === 'number' && nextEventCandidate > 0
			? nextEventCandidate
			: null

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
			executePublicServerQuery,
			currentEventId
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
		<LiveMatchesClient
			initialMatches={matches}
			initialError={initialError}
			currentEventId={renderedCurrentEventId}
			nextEventId={renderedNextEventId ?? undefined}
			initialSnapshot={snapshot}
		/>
	)
}
