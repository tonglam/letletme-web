import { LiveMatchesEntry } from '@/app/live/matches/LiveMatchesEntry'
import { SeasonPhaseState } from '@/components/feedback/SeasonPhaseState'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { executePublicServerQuery } from '@/lib/graphql-server'
import { getLiveMatchesSnapshot } from '@/lib/live-matches'
import { selectLiveMatchEvent } from '@/lib/live-match-selection'
import { getLivePageContext } from '@/lib/live-context-server'
import { isOfficialLiveUpdatingContext } from '@/lib/live-updating'
import { getTranslations } from 'next-intl/server'

type PageProps = { params: LocaleParams }

function LiveContractMarker({
	status,
	revision,
	expected,
	observed
}: {
	status: 'READY' | 'STALE' | 'UNAVAILABLE'
	revision: string
	expected: number
	observed: number
}) {
	return (
		<span
			hidden
			data-letletme-contract="live_matches"
			data-status={status}
			data-revision={revision}
			data-expected={String(expected)}
			data-observed={String(observed)}
		/>
	)
}

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
	const isOfficialUpdating = isOfficialLiveUpdatingContext(liveContext)
	if (
		(!liveContext?.anchorEventId && presentation.phase !== 'PRESEASON') ||
		liveContext?.windowState === 'OFFSEASON' ||
		presentation.phase === 'UNAVAILABLE'
	) {
		return (
			<>
				<LiveContractMarker
					status="UNAVAILABLE"
					revision={liveContext?.scoreCoreRevision ?? 'unavailable'}
					expected={0}
					observed={0}
				/>
				<SeasonPhaseState
					feature="matches"
					presentation={presentation}
				/>
			</>
		)
	}

	const currentEventId =
		liveContext?.anchorEventId ?? presentation.currentEventId
	if (!currentEventId) {
		return (
			<>
				<LiveContractMarker
					status="UNAVAILABLE"
					revision={liveContext?.scoreCoreRevision ?? 'unavailable'}
					expected={0}
					observed={0}
				/>
				<SeasonPhaseState
					feature="matches"
					presentation={presentation}
				/>
			</>
		)
	}
	const nextEventId = presentation.nextEventId

	let matches: Awaited<ReturnType<typeof getLiveMatchesSnapshot>>['matches'] =
		[]
	let snapshot: Awaited<ReturnType<typeof getLiveMatchesSnapshot>>['snapshot'] =
		null
	let renderedCurrentEventId = currentEventId
	let renderedSelectedEventId = currentEventId
	let renderedNextEventId = nextEventId
	let initialError: string | null = null

	try {
		const live = await getLiveMatchesSnapshot(
			nextEventId,
			(query, variables, options) =>
				executePublicServerQuery('gameweek', query, variables, options),
			currentEventId,
			{
				scoreCoreRevision: liveContext?.scoreCoreRevision,
				includeFixturePlayers: false,
				suppressErrorLog: isOfficialUpdating
			}
		)
		matches = live.matches
		snapshot = live.snapshot
		renderedCurrentEventId = live.currentEventId ?? currentEventId
		renderedNextEventId = live.nextEventId
		renderedSelectedEventId = selectLiveMatchEvent(
			matches,
			renderedCurrentEventId,
			new Date()
		)
		if (renderedSelectedEventId !== renderedCurrentEventId) {
			matches = matches.filter(
				match => match.eventId === renderedSelectedEventId
			)
			snapshot = null
		}
		if (
			snapshot?.eventId != null &&
			snapshot.eventId !== renderedCurrentEventId
		) {
			console.warn(
				'[live/matches] liveSnapshot.eventId differs from isCurrent',
				{
					snapshotEventId: snapshot.eventId,
					currentEventId: renderedCurrentEventId
				}
			)
		}
	} catch (error) {
		if (!isOfficialUpdating) {
			console.error('Failed to fetch live matches:', error)
			initialError = t('matchesFailed')
		}
	}
	const markerStatus = initialError
		? 'UNAVAILABLE'
		: liveContext?.dataAvailability === 'UNAVAILABLE'
			? 'UNAVAILABLE'
			: liveContext?.stale ||
				  liveContext?.dataAvailability === 'STALE' ||
				  liveContext?.dataAvailability === 'DEGRADED'
				? 'STALE'
				: 'READY'
	const markerRevision =
		snapshot?.scoreCoreRevision ??
		liveContext?.scoreCoreRevision ??
		'unavailable'
	const markerObserved = matches.length

	return (
		<>
			<LiveContractMarker
				status={markerStatus}
				revision={markerRevision}
				expected={markerObserved}
				observed={markerObserved}
			/>
			<LiveMatchesEntry
				initialMatches={matches}
				initialError={initialError}
				currentEventId={renderedCurrentEventId}
				selectedEventId={renderedSelectedEventId}
				nextEventId={renderedNextEventId ?? undefined}
				initialSnapshot={snapshot}
				isOfficialUpdating={isOfficialUpdating}
			/>
		</>
	)
}
