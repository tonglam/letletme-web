import TeamPointsClient from '@/app/live/points/[id]/TeamPointsClient'
import { SeasonPhaseState } from '@/components/feedback/SeasonPhaseState'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { getLivePageContext } from '@/lib/live-context-server'
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
	const { tournamentId } = await searchParams
	const entryId = Number(id)

	const { presentation } = await getLivePageContext()
	if (
		presentation.phase === 'PRESEASON' ||
		presentation.phase === 'BETWEEN_GAMEWEEKS' ||
		presentation.phase === 'OFFSEASON' ||
		presentation.phase === 'UNAVAILABLE'
	) {
		return <SeasonPhaseState feature="points" presentation={presentation} />
	}

	const currentEventId = presentation.currentEventId
	if (!currentEventId) {
		return <SeasonPhaseState feature="points" presentation={presentation} />
	}

	let initialLiveData: LiveCalcData | undefined
	let initialSnapshot: LiveSnapshotStatus | null = null

	if (Number.isInteger(entryId) && entryId > 0) {
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
		/>
	)
}
