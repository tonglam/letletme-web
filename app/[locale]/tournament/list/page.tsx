import { executeServerQuery } from '@/lib/graphql-server'
import {
	GET_ENTRY_TOURNAMENTS,
	type EntryTournament,
	type EntryTournamentsResponse,
} from '@/lib/graphql/operations/tournaments'
import { getCurrentEntryId, getCurrentSession } from '@/lib/session'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { localizeHref } from '@/i18n/routing'
import { redirect } from 'next/navigation'
import TournamentListClient from '@/app/tournament/list/TournamentListClient'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/tournament/list',
		titleKey: 'tournamentListTitle',
		descriptionKey: 'tournamentListDescription',
	})
}

export default async function Page({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	const t = await getTranslations('States')
	const session = await getCurrentSession()

	if (!session) {
		redirect(localizeHref('/auth/login?next=/tournament/list', locale))
	}

	const entryId = await getCurrentEntryId()
	if (!entryId) {
		redirect(localizeHref('/onboarding/bind-entry', locale))
	}

	let initialTournaments: EntryTournament[] = []
	let initialError: string | null = null
	try {
		const response = await executeServerQuery<EntryTournamentsResponse>(
			GET_ENTRY_TOURNAMENTS,
			{ entryId },
			{ cache: 'no-store' },
		)
		initialTournaments = response.entryTournaments
	} catch (error) {
		console.error('[tournament list] Failed to load:', error)
		initialError = t('tournamentsUnavailable')
	}

	return (
		<TournamentListClient
			currentEntryId={entryId}
			initialTournaments={initialTournaments}
			initialError={initialError}
		/>
	)
}
