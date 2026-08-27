import LivePointsClient from '@/app/live/points/LivePointsClient'
import { SeasonPhaseState } from '@/components/feedback/SeasonPhaseState'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { getLivePageContext } from '@/lib/live-context-server'
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
import { getCurrentEntryId } from '@/lib/session'

export const dynamic = 'force-dynamic'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/live/points',
		titleKey: 'livePointsTitle',
		descriptionKey: 'livePointsDescription'
	})
}

export default async function LivePointsPage({ params }: PageProps) {
	await getPageLocale(params)

	const { presentation, liveContext } = await getLivePageContext()
	if (
		presentation.phase === 'PRESEASON' ||
		liveContext?.windowState === 'PRESEASON' ||
		liveContext?.windowState === 'OFFSEASON' ||
		(!liveContext?.anchorEventId &&
			presentation.phase !== 'BETWEEN_GAMEWEEKS') ||
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
		liveContext?.anchorEventId ?? presentation.currentEventId
	if (!currentEventId) {
		return (
			<SeasonPhaseState
				feature="points"
				presentation={presentation}
			/>
		)
	}

	// Only then session-scoped seed.
	const entryId = await getCurrentEntryId()
	let initialLiveData: LiveCalcData | undefined
	let initialSnapshot: LiveSnapshotStatus | null = null
	let initialOverall: EntryOverallSnapshot | undefined
	let initialEntryLookupStatus: EntryLookupStatus | undefined
	let initialEntryPersistenceState: EntryPersistenceState | null | undefined

	if (entryId) {
		const [liveResult, overallResult] = await Promise.allSettled([
			executeServerQuery<LiveCalcDataResponse>(
				GET_LIVE_POINTS,
				{ eventId: currentEventId, entryId },
				{ cache: 'no-store' }
			),
			executeServerQuery<EntrySummaryResponse>(
				GET_ENTRY,
				{ id: entryId },
				{ cache: 'no-store' }
			)
		])
		if (liveResult.status === 'fulfilled') {
			const liveData = liveResult.value.calcLivePointsByEntry
			// The first lookup can enqueue a picks sync and return an empty
			// placeholder. Do not seed that placeholder or the client hook will
			// treat the empty response as a successful initial load.
			if (liveData.pickList.length > 0) initialLiveData = liveData
			initialSnapshot =
				liveContextToSnapshot(liveContext) ??
				liveData.snapshot ??
				null
		} else {
			console.error(
				'[live points] Failed to seed current entry:',
				liveResult.reason
			)
		}
		if (overallResult.status === 'fulfilled') {
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
				'[live points] Failed to seed current entry overall:',
				overallResult.reason
			)
		}
	}

	return (
		<LivePointsClient
			initialEntryId={entryId ?? 0}
			initialEventId={currentEventId}
			initialLiveData={initialLiveData}
			initialSnapshot={initialSnapshot}
			initialOverall={initialOverall}
			initialEntryLookupStatus={initialEntryLookupStatus}
			initialEntryPersistenceState={initialEntryPersistenceState}
		/>
	)
}
