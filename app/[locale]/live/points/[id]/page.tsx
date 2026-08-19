import TeamPointsClient from '@/app/live/points/[id]/TeamPointsClient'
import { SeasonPhaseState } from '@/components/feedback/SeasonPhaseState'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { getLivePageContext } from '@/lib/live-context-server'
import {
	GET_ENTRY,
	type EntryOverallSnapshot,
	type EntrySummaryResponse,
} from '@/lib/graphql/operations/entries'
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
	const { gw, tournamentId } = await searchParams
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
	const requestedGameweekValue = typeof gw === 'string' ? Number(gw) : null
	const requestedGameweek =
		requestedGameweekValue !== null &&
		Number.isInteger(requestedGameweekValue) &&
		requestedGameweekValue >= 1 &&
		requestedGameweekValue <= 38
			? requestedGameweekValue
			: null
	const initialEventId = requestedGameweek ?? currentEventId

	let initialLiveData: LiveCalcData | undefined
	let initialSnapshot: LiveSnapshotStatus | null = null
	let initialOverall: EntryOverallSnapshot | undefined

	if (Number.isInteger(entryId) && entryId > 0) {
		const [liveResult, overallResult] = await Promise.allSettled([
			executeServerQuery<LiveCalcDataResponse>(
				GET_LIVE_POINTS,
				{ eventId: initialEventId, entryId },
				{ cache: 'no-store' },
			),
			executeServerQuery<EntrySummaryResponse>(
				GET_ENTRY,
				{ id: entryId },
				{ cache: 'no-store' },
			),
		])

		if (liveResult.status === 'fulfilled') {
			initialLiveData = liveResult.value.calcLivePointsByEntry
			initialSnapshot = liveResult.value.liveSnapshot
		} else {
			console.error('Failed to seed live points page:', liveResult.reason)
		}

		if (overallResult.status === 'fulfilled' && overallResult.value.entry) {
			const entry = overallResult.value.entry
			initialOverall = {
				overallPoints: entry.overallPoints,
				overallRank: entry.overallRank,
				teamValue: entry.teamValue,
				bank: entry.bank,
				totalTransfers: entry.totalTransfers,
			}
		} else if (overallResult.status === 'rejected') {
			console.error('Failed to seed team overall snapshot:', overallResult.reason)
		}
	}

	return (
		<TeamPointsClient
			entryId={entryId}
			tournamentId={typeof tournamentId === 'string' ? tournamentId : undefined}
			initialEventId={currentEventId}
			initialSelectedGameweek={requestedGameweek ?? undefined}
			initialLiveData={initialLiveData}
			initialSnapshot={initialSnapshot}
			initialOverall={initialOverall}
		/>
	)
}
