import TournamentListClient from '@/app/tournament/browse/TournamentListClient'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { localizeHref } from '@/i18n/routing'
import {
	GET_ENTRY_TOURNAMENTS_LIST,
	type EntryTournamentListItem,
	type EntryTournamentsListResponse,
} from '@/lib/graphql/operations/tournaments'
import { executeServerQueryWithSession } from '@/lib/graphql-server'
import { getVerifiedEntryContext } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

type PageProps = {
	params: LocaleParams
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/competitions/browse',
		titleKey: 'tournamentListTitle',
		descriptionKey: 'tournamentListDescription',
	})
}

export default async function Page({ params, searchParams }: PageProps) {
	const { locale } = await getPageLocale(params)
	const t = await getTranslations('States')
	const resolvedSearchParams = await searchParams

	// One authorization session for gate + GraphQL headers (no triple getSession).
	const { session, entryId } = await getVerifiedEntryContext()

	if (!session) {
		redirect(localizeHref('/auth/login?next=/competitions/browse', locale))
	}
	if (!entryId) {
		redirect(localizeHref('/onboarding/bind-entry', locale))
	}

	const mineParam = resolvedSearchParams.mine
	const initialAdminOnly =
		mineParam === 'true' || mineParam === '1' || mineParam === 'yes'

	let initialTournaments: EntryTournamentListItem[] = []
	let initialError: string | null = null
	try {
		const response = await executeServerQueryWithSession<EntryTournamentsListResponse>(
			session,
			GET_ENTRY_TOURNAMENTS_LIST,
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
			initialAdminOnly={initialAdminOnly}
		/>
	)
}
