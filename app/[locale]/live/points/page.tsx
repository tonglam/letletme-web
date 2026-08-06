import LivePointsClient from '@/app/live/points/LivePointsClient'
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
import { getCurrentEntryId } from '@/lib/session'
import { CalendarX2 } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

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
	const t = await getTranslations('States')
	const [entryId, events] = await Promise.all([
		getCurrentEntryId(),
		getCurrentAndNextEvents(),
	])
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
