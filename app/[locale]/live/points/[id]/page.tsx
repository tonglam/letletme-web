import TeamPointsClient from '@/app/live/points/[id]/TeamPointsClient'
import { SeasonPhaseState } from '@/components/feedback/SeasonPhaseState'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { getLivePageContext } from '@/lib/live-context-server'
import { isOfficialLiveUpdatingContext } from '@/lib/live-updating'
import { liveContextToSnapshot } from '@/lib/live-refresh'
import {
	GET_ENTRY,
	type EntryOverallSnapshot,
	type EntryLookupStatus,
	type EntryPersistenceState,
	type EntrySummaryResponse
} from '@/lib/graphql/operations/entries'
import {
	GET_LIVE_POINTS,
	type LiveCalcData,
	type LiveCalcDataResponse,
	type LiveSnapshotStatus
} from '@/lib/graphql/operations/live'
import { executeServerQuery } from '@/lib/graphql-server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps) {
	const { id, locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: `/live/points/${encodeURIComponent(id)}`,
		titleKey: 'entryPointsTitle',
		titleValues: { id }
	})
}

type PageProps = {
	params: LocaleParams<{ id: string }>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ params, searchParams }: PageProps) {
	const { id } = await getPageLocale(params)
	const { from, gw, tournamentId } = await searchParams
	const entryId = Number(id)
	const requestedGameweekValue = typeof gw === 'string' ? Number(gw) : null
	const speculativeEventId =
		requestedGameweekValue !== null &&
		Number.isInteger(requestedGameweekValue) &&
		requestedGameweekValue >= 1 &&
		requestedGameweekValue <= 38
			? requestedGameweekValue
			: null
	// Competition links carry an explicit GW. Start that independent score read
	// while the shared lifecycle context is loading, then retain it only after
	// the context validates that the requested event belongs to this season.
	const speculativeLiveRequest =
		Number.isInteger(entryId) && entryId > 0 && speculativeEventId !== null
			? executeServerQuery<LiveCalcDataResponse>(
					GET_LIVE_POINTS,
					{ eventId: speculativeEventId, entryId },
					{ cache: 'no-store', suppressErrorLog: true }
				)
			: null
	// The lifecycle gate can return before this read is needed; attach a handler
	// immediately so an invalid/expired GW never creates an unhandled rejection.
	void speculativeLiveRequest?.catch(() => undefined)

	const { presentation, liveContext } = await getLivePageContext()
	const historicalMaxGameweek =
		liveContext?.anchorEventId ??
		presentation.currentEventId ??
		presentation.latestFinishedEventId
	const requestedGameweek =
		requestedGameweekValue !== null &&
		Number.isInteger(requestedGameweekValue) &&
		requestedGameweekValue >= 1 &&
		historicalMaxGameweek !== null &&
		requestedGameweekValue <= historicalMaxGameweek
			? requestedGameweekValue
			: null
	const allowHistoricalBetweenGameweeks =
		liveContext?.windowState === 'BETWEEN_GAMEWEEKS' ||
		(presentation.phase === 'BETWEEN_GAMEWEEKS' && requestedGameweek !== null)
	if (
		presentation.phase === 'PRESEASON' ||
		(presentation.phase === 'BETWEEN_GAMEWEEKS' &&
			!allowHistoricalBetweenGameweeks) ||
		presentation.phase === 'OFFSEASON' ||
		presentation.phase === 'UNAVAILABLE'
	) {
		return (
			<SeasonPhaseState
				feature="points"
				presentation={presentation}
			/>
		)
	}

	const currentEventId =
		liveContext?.anchorEventId ??
		presentation.currentEventId ??
		(allowHistoricalBetweenGameweeks
			? presentation.latestFinishedEventId
			: null)
	if (!currentEventId) {
		return (
			<SeasonPhaseState
				feature="points"
				presentation={presentation}
			/>
		)
	}
	const initialEventId = requestedGameweek ?? currentEventId
	const isOfficialUpdating =
		initialEventId === currentEventId &&
		isOfficialLiveUpdatingContext(liveContext)
	const seedCurrentOverall = initialEventId === currentEventId

	let initialLiveData: LiveCalcData | undefined
	let initialSnapshot: LiveSnapshotStatus | null = null
	let initialOverall: EntryOverallSnapshot | undefined
	let initialEntryLookupStatus: EntryLookupStatus | undefined
	let initialEntryPersistenceState: EntryPersistenceState | null | undefined

	if (Number.isInteger(entryId) && entryId > 0) {
		const [liveResult, overallResult] = await Promise.allSettled([
			speculativeLiveRequest && initialEventId === speculativeEventId
				? speculativeLiveRequest
				: executeServerQuery<LiveCalcDataResponse>(
						GET_LIVE_POINTS,
						{ eventId: initialEventId, entryId },
						{
							cache: 'no-store',
							suppressErrorLog: isOfficialUpdating
						}
					),
			seedCurrentOverall
				? executeServerQuery<EntrySummaryResponse>(
						GET_ENTRY,
						{ id: entryId },
						{ cache: 'no-store' }
					)
				: Promise.resolve(null)
		])

		if (liveResult.status === 'fulfilled') {
			const liveData = liveResult.value.calcLivePointsByEntry
			// A first lookup for an entry may enqueue its FPL picks and return
			// an intentionally empty placeholder. Do not seed that placeholder
			// into the client: the live-points hook must be allowed to retry.
			if (liveData.pickList.length > 0) {
				initialLiveData = liveData
			}
			initialSnapshot =
				(liveContext?.anchorEventId === initialEventId
					? liveContextToSnapshot(liveContext)
					: null) ??
				liveData.snapshot ??
				null
		} else if (!isOfficialUpdating) {
			console.error('Failed to seed live points page:', liveResult.reason)
		}

		if (overallResult.status === 'fulfilled' && overallResult.value) {
			initialEntryLookupStatus = overallResult.value.entryLookup.status
			initialEntryPersistenceState =
				overallResult.value.entryLookup.persistenceState
			const entry = overallResult.value.entryLookup.entry
			if (entry) {
				initialOverall = {
					overallPoints: entry.overallPoints,
					overallRank: entry.overallRank,
					teamValue: entry.teamValue,
					bank: entry.bank,
					totalTransfers: entry.totalTransfers
				}
			}
		} else if (overallResult.status === 'rejected') {
			initialEntryLookupStatus = 'UNAVAILABLE'
			initialEntryPersistenceState = undefined
			console.error(
				'Failed to seed team overall snapshot:',
				overallResult.reason
			)
		}
	}

	return (
		<TeamPointsClient
			entryId={entryId}
			tournamentId={typeof tournamentId === 'string' ? tournamentId : undefined}
			from={from === 'home' ? 'home' : undefined}
			initialEventId={currentEventId}
			initialSelectedGameweek={requestedGameweek ?? undefined}
			initialLiveData={initialLiveData}
			initialSnapshot={initialSnapshot}
			initialOverall={initialOverall}
			initialEntryLookupStatus={initialEntryLookupStatus}
			initialEntryPersistenceState={initialEntryPersistenceState}
			isOfficialUpdating={isOfficialUpdating}
		/>
	)
}
