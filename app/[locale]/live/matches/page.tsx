import { LiveMatchesEntry } from '@/app/live/matches/LiveMatchesEntry'
import { SeasonPhaseState } from '@/components/feedback/SeasonPhaseState'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { executePublicServerQuery } from '@/lib/graphql-server'
import { getLiveMatchesSnapshot, type QueryExecutor } from '@/lib/live-matches'
import { getLivePageContext } from '@/lib/live-context-server'
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
	const executor: QueryExecutor = (query, variables, options) =>
		executePublicServerQuery('gameweek', query, variables, options)
	let live: Awaited<ReturnType<typeof getLiveMatchesSnapshot>> | null = null
	let initialError: string | null = null
	const loadPageContext = () => getLivePageContext()

	// The Match active-event pointer is the normal page authority. This keeps a
	// READY render to one GraphQL root and avoids coupling Match availability to
	// the Live Points lifecycle/context path.
	try {
		live = await getLiveMatchesSnapshot(executor)
	} catch (error) {
		console.error('Failed to fetch live matches:', error)
		initialError = t('matchesFailed')
	}

	// An event-less Match request may legitimately return a fallback
	// publication. Before seeding the client, corroborate that fallback's event
	// with the lifecycle anchor so REDIS_PREVIOUS/process-LKG/checkpoint data
	// cannot pin the page to an older gameweek.
	const fallbackSnapshot =
		live?.snapshot && live.delivery.servedFrom !== 'REDIS_CURRENT'
			? live.snapshot
			: null
	const fallbackSnapshotEventId = fallbackSnapshot?.eventId
	const fallbackContext = fallbackSnapshot ? await loadPageContext() : null
	if (fallbackContext && fallbackSnapshot) {
		const context = fallbackContext
		const activeEventId =
			context.liveContext?.anchorEventId ?? context.presentation.currentEventId
		if (activeEventId !== fallbackSnapshotEventId) {
			live = null
		}
	}

	if (!live?.snapshot) {
		const { presentation, liveContext } =
			fallbackContext ?? (await loadPageContext())
		const fallbackEventId =
			liveContext?.anchorEventId ?? presentation.currentEventId
		if (
			!fallbackEventId ||
			liveContext?.windowState === 'OFFSEASON' ||
			presentation.phase === 'UNAVAILABLE' ||
			presentation.phase === 'PRESEASON'
		) {
			return (
				<>
					<LiveContractMarker
						status="UNAVAILABLE"
						revision="unavailable"
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
		try {
			const explicitLive = await getLiveMatchesSnapshot(
				executor,
				fallbackEventId
			)
			if (
				explicitLive.snapshot &&
				explicitLive.snapshot.eventId !== fallbackEventId
			) {
				live = null
				initialError = t('matchesFailed')
			} else {
				live = explicitLive
				initialError = null
			}
		} catch (error) {
			console.error('Failed to fetch explicit live matchday:', error)
			initialError = t('matchesFailed')
		}
	}
	// A valid V3 response without a snapshot is the expected official sync
	// window, not a page error. The client keeps polling until it is published.
	if (!live) initialError ??= t('matchesFailed')

	const matches = live?.matches ?? []
	const snapshot = live?.snapshot ?? null
	const renderedCurrentEventId = live?.currentEventId ?? snapshot?.eventId
	const markerStatus =
		!snapshot || live?.availability !== 'READY'
			? 'UNAVAILABLE'
			: live.delivery.state === 'STALE' ||
				  live.delivery.state === 'DEGRADED' ||
				  live.delivery.state === 'PENDING'
				? 'STALE'
				: 'READY'
	const markerRevision = snapshot?.revisions.scoreState ?? 'unavailable'
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
				currentEventId={renderedCurrentEventId ?? undefined}
				selectedEventId={renderedCurrentEventId ?? undefined}
				initialSnapshot={snapshot}
			/>
		</>
	)
}
