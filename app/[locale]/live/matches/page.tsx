import { LiveMatchesClient } from '@/app/live/matches/LiveMatchesClient'
import { CurrentGameweekUnavailable } from '@/components/feedback/CurrentGameweekUnavailable'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_LIVE_CONTEXT,
	type LiveContextResponse
} from '@/lib/graphql/operations/live'
import { getLiveMatchesSnapshot } from '@/lib/live-matches'
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

	// The lifecycle context is the single public gate for both current and next
	// event identity.  The match desk then reads the same revision directly in
	// RSC, avoiding a second event query and any self-HTTP hop.
	const context = await executePublicServerQuery<LiveContextResponse>(
		GET_LIVE_CONTEXT,
		undefined,
		{ cache: 'no-store' }
	)
	const currentEventId = context.liveContext?.eventId
	if (!currentEventId) {
		return <CurrentGameweekUnavailable />
	}
	const nextEventId = context.liveContext?.nextEventId ?? null

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
			currentEventId,
			{ revision: context.liveContext?.revision }
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
