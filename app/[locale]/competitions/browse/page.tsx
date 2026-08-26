import TournamentListClient from '@/app/tournament/browse/TournamentListClient'
import { RouteIntlProvider } from '@/components/i18n/RouteIntlProvider'
import { ROUTE_CLIENT_NAMESPACES } from '@/i18n/client-namespaces'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { localizeHref } from '@/i18n/routing'
import {
	GET_MANAGEABLE_TOURNAMENTS_LIST,
	GET_ENTRY_TOURNAMENTS_LIST,
	type EntryTournamentListItem,
	type EntryTournamentsListResponse,
	type ManageableTournamentsListResponse
} from '@/lib/graphql/operations/tournaments'
import { executeServerQueryWithSession } from '@/lib/graphql-server'
import { getVerifiedEntryContext } from '@/lib/session'
import { isPlatformAdminIdentity } from '@/lib/platform-admin'
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
		titleKey: 'competitionListTitle',
		descriptionKey: 'competitionListDescription'
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
	let participatingTournamentIds: number[] | null = []
	let initialError: string | null = null
	try {
		if (initialAdminOnly) {
			const [manageable, participating] = await Promise.allSettled([
				executeServerQueryWithSession<ManageableTournamentsListResponse>(
					session,
					GET_MANAGEABLE_TOURNAMENTS_LIST,
					{ entryId },
					{ cache: 'no-store' }
				),
				executeServerQueryWithSession<EntryTournamentsListResponse>(
					session,
					GET_ENTRY_TOURNAMENTS_LIST,
					{ entryId },
					{ cache: 'no-store' }
				)
			])
			if (manageable.status === 'rejected') throw manageable.reason
			initialTournaments = manageable.value.manageableTournaments
			if (participating.status === 'fulfilled') {
				participatingTournamentIds = participating.value.entryTournaments.map(
					tournament => tournament.id
				)
			} else {
				participatingTournamentIds = null
				console.warn(
					'[tournament list] Membership badges unavailable; preserving manageable list'
				)
			}
		} else {
			const response =
				await executeServerQueryWithSession<EntryTournamentsListResponse>(
					session,
					GET_ENTRY_TOURNAMENTS_LIST,
					{ entryId },
					{ cache: 'no-store' }
				)
			initialTournaments = response.entryTournaments
			participatingTournamentIds = initialTournaments.map(
				tournament => tournament.id
			)
		}
	} catch (error) {
		console.error('[tournament list] Failed to load:', error)
		initialError = t('competitionsUnavailable')
	}

	return (
		<RouteIntlProvider namespaces={ROUTE_CLIENT_NAMESPACES.competitionsBrowse}>
			<TournamentListClient
				currentEntryId={entryId}
				platformAdmin={isPlatformAdminIdentity(session.user)}
				initialTournaments={initialTournaments}
				participatingTournamentIds={participatingTournamentIds}
				initialError={initialError}
				initialAdminOnly={initialAdminOnly}
			/>
		</RouteIntlProvider>
	)
}
