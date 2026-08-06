import TeamPointsClient from '@/app/live/points/[id]/TeamPointsClient'
import { PageState } from '@/components/feedback/PageState'
import PageShell from '@/components/layout/PageShell'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { getCurrentAndNextEvents } from '@/lib/events'
import {
	GET_LIVE_POINTS,
	type LiveCalcData,
	type LiveCalcDataResponse,
	type LiveSnapshotStatus,
} from '@/lib/graphql/operations/live'
import { executeServerQuery } from '@/lib/graphql-server'
import { CalendarX2 } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

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
	const t = await getTranslations('States')
	const { tournamentId } = await searchParams
	const entryId = Number(id)
	const events = await getCurrentAndNextEvents()
	const currentEventId = events?.current[0]?.id
	let initialLiveData: LiveCalcData | undefined
	let initialSnapshot: LiveSnapshotStatus | null = null

	if (!currentEventId) {
		return (
			<PageShell>
				<PageState
					icon={CalendarX2}
					title={t('gameweekUnavailableTitle')}
					description={t('gameweekUnavailableDescription')}
				/>
			</PageShell>
		)
	}

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
		<Suspense
			fallback={
				<div className="container mx-auto max-w-4xl px-4 py-8">
					<div className="rounded-lg bg-card p-6 text-sm text-muted-foreground shadow-sm">
						{t('loadingTeamPoints')}
					</div>
				</div>
			}
		>
			<TeamPointsClient
				entryId={entryId}
				tournamentId={
					typeof tournamentId === 'string' ? tournamentId : undefined
				}
				initialEventId={currentEventId}
				initialLiveData={initialLiveData}
				initialSnapshot={initialSnapshot}
			/>
		</Suspense>
	)
}
