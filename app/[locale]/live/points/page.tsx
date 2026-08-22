import LivePointsClient from '@/app/live/points/LivePointsClient'
import { SeasonPhaseState } from '@/components/feedback/SeasonPhaseState'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { getLivePageContext } from '@/lib/live-context-server'
import { liveContextToSnapshot } from '@/lib/live-refresh'
import {
	GET_LIVE_POINTS,
	type LiveCalcData,
	type LiveCalcDataResponse,
	type LiveSnapshotStatus,
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
		descriptionKey: 'livePointsDescription',
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
		return <SeasonPhaseState feature="points" presentation={presentation} />
	}

	const currentEventId = liveContext?.anchorEventId ?? presentation.currentEventId
	if (!currentEventId) {
		return <SeasonPhaseState feature="points" presentation={presentation} />
	}

	// Only then session-scoped seed.
	const entryId = await getCurrentEntryId()
	let initialLiveData: LiveCalcData | undefined
	let initialSnapshot: LiveSnapshotStatus | null = null

	if (entryId) {
		try {
			const response = await executeServerQuery<LiveCalcDataResponse>(
				GET_LIVE_POINTS,
				{ eventId: currentEventId, entryId },
				{ cache: 'no-store' },
			)
			initialLiveData = response.calcLivePointsByEntry
			initialSnapshot =
				liveContextToSnapshot(liveContext) ??
				response.calcLivePointsByEntry.snapshot ??
				null
		} catch (error) {
			console.error('[live points] Failed to seed current entry:', error)
		}
	}

	return (
		<LivePointsClient
			initialEntryId={entryId ?? 0}
			initialEventId={currentEventId}
			initialLiveData={initialLiveData}
			initialSnapshot={initialSnapshot}
		/>
	)
}
