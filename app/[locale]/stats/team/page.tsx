import { PageState } from '@/components/feedback/PageState'
import PageShell from '@/components/layout/PageShell'
import { getCurrentAndNextEvents } from '@/lib/events'
import { executeServerQuery } from '@/lib/graphql-server'
import {
	GET_ENTRY_EVENT_RESULT,
	type EntryEventResult,
	type EntryEventResultResponse,
} from '@/lib/graphql/operations/entries'
import { getCurrentEntryId, getCurrentSession } from '@/lib/session'
import { CalendarX2 } from 'lucide-react'
import { redirect } from 'next/navigation'
import TeamStatsClient from '@/app/stats/team/TeamStatsClient'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { localizeHref } from '@/i18n/routing'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/stats/team',
		titleKey: 'teamStatsTitle',
		descriptionKey: 'teamStatsDescription',
	})
}

export default async function TeamStatsPage({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	const t = await getTranslations('States')
	const [session, entryId, events] = await Promise.all([
		getCurrentSession(),
		getCurrentEntryId(),
		getCurrentAndNextEvents(),
	])
	if (!session) redirect(localizeHref('/auth/login?next=/stats/team', locale))
	if (!entryId) redirect(localizeHref('/onboarding/bind-entry', locale))

	const currentGameweek = events?.current[0]?.id

	if (!currentGameweek) {
		return (
			<PageShell>
				<PageState
					icon={CalendarX2}
					title={t('teamStatsUnavailableTitle')}
					description={t('gameweekUnavailableDescription')}
				/>
			</PageShell>
		)
	}

	let initialEntryEventResult: EntryEventResult | null = null
	let initialError: string | null = null
	let initialRequestComplete = false

	try {
		const response = await executeServerQuery<EntryEventResultResponse>(
			GET_ENTRY_EVENT_RESULT,
			{ eventId: currentGameweek, entryId },
			{ cache: 'no-store' },
		)
		initialEntryEventResult = response.entryEventResult ?? null
		initialRequestComplete = true
	} catch (error) {
		console.error('[team stats] Failed to seed current gameweek:', error)
		initialError = t('teamStatsUnavailable')
	}

	return (
		<TeamStatsClient
			entryId={entryId}
			currentGameweek={currentGameweek}
			initialEntryEventResult={initialEntryEventResult}
			initialError={initialError}
			initialRequestComplete={initialRequestComplete}
		/>
	)
}
