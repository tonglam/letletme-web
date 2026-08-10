import LivePointsClient from '@/app/live/points/LivePointsClient'
import { CurrentGameweekUnavailable } from '@/components/feedback/CurrentGameweekUnavailable'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { getCurrentEventId } from '@/lib/events'
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

	// 1) Gate on isCurrent alone — do not wait on session/entry first.
	const currentEventId = await getCurrentEventId()
	if (!currentEventId) {
		return <CurrentGameweekUnavailable />
	}

	// 2) Only then session-scoped seed.
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
			initialSnapshot = response.liveSnapshot
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
