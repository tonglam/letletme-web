import TeamPointsClient from '@/app/live/points/[id]/TeamPointsClient'
import { CurrentGameweekUnavailable } from '@/components/feedback/CurrentGameweekUnavailable'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { getCurrentEventId } from '@/lib/events'
import {
	createMockLiveData,
	MOCK_LIVE_SNAPSHOT,
} from '@/app/live/points/_lib/live-points-mock'
import {
	GET_LIVE_POINTS,
	type LiveCalcData,
	type LiveCalcDataResponse,
	type LiveSnapshotStatus,
} from '@/lib/graphql/operations/live'
import { executeServerQuery } from '@/lib/graphql-server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps) {
	const { id, locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: `/live/points/${encodeURIComponent(id)}`,
		titleKey: 'entryPointsTitle',
		titleValues: { id },
	})
}

type PageProps = {
	params: LocaleParams<{ id: string }>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ params, searchParams }: PageProps) {
	const { id } = await getPageLocale(params)
	const { mock, tournamentId } = await searchParams
	const entryId = Number(id)
	const isMock = mock === '1'
	const mockLiveData = isMock
		? createMockLiveData(Number.isInteger(entryId) && entryId > 0 ? entryId : 24001)
		: undefined

	// Gate first — no Suspense shell around seeded client work.
	const currentEventId = isMock ? mockLiveData?.event ?? 22 : await getCurrentEventId()
	if (!currentEventId) {
		return <CurrentGameweekUnavailable />
	}

	let initialLiveData: LiveCalcData | undefined = mockLiveData
	let initialSnapshot: LiveSnapshotStatus | null = isMock
		? MOCK_LIVE_SNAPSHOT
		: null

	if (!isMock && Number.isInteger(entryId) && entryId > 0) {
		try {
			const liveResponse = await executeServerQuery<LiveCalcDataResponse>(
				GET_LIVE_POINTS,
				{ eventId: currentEventId, entryId },
				{ cache: 'no-store' },
			)
			initialLiveData = liveResponse.calcLivePointsByEntry
			initialSnapshot = liveResponse.liveSnapshot
		} catch (err) {
			console.error('Failed to seed live points page:', err)
		}
	}

	return (
		<TeamPointsClient
			entryId={entryId}
			tournamentId={typeof tournamentId === 'string' ? tournamentId : undefined}
			initialEventId={currentEventId}
			initialLiveData={initialLiveData}
			initialSnapshot={initialSnapshot}
			isMock={isMock}
		/>
	)
}
