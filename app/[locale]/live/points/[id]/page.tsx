import { PageState } from '@/components/feedback/PageState'
import PageShell from '@/components/layout/PageShell'
import { Suspense } from 'react'
import { getCurrentAndNextEvents } from '@/lib/events'
import { executeServerQuery } from '@/lib/graphql-server'
import {
	GET_LIVE_POINTS,
	type LiveCalcData,
	type LiveCalcDataResponse,
	type LiveSnapshotStatus
} from '@/lib/graphql/operations/live'
import TeamPointsClient from '@/app/live/points/[id]/TeamPointsClient'
import { CalendarX2 } from 'lucide-react'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps) {
	const { id, locale } = await getPageLocale(params)
	const metadata = await getPageMetadata({
		locale,
		pathname: `/live/points/${encodeURIComponent(id)}`,
		titleKey: 'entryPointsTitle'
	})
	const t = await getTranslations({ locale, namespace: 'PageMetadata' })
	return { ...metadata, title: t('entryPointsTitle', { id }) }
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
				{ cache: 'no-store' }
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
				<div className="container max-w-4xl mx-auto px-4 py-8">
					<div className="bg-card rounded-lg shadow-sm p-6 text-sm text-muted-foreground">
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
