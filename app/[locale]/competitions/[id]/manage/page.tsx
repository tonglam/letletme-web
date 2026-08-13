import ManageTournamentClient from '@/app/tournament/[id]/manage/ManageTournamentClient'
import { PageState } from '@/components/feedback/PageState'
import { Button } from '@/components/ui/button'
import {
	GET_MANAGED_TOURNAMENT,
	type ManagedTournamentResponse,
} from '@/lib/graphql/operations/tournaments'
import { GraphQLRequestError } from '@/lib/graphql-client'
import { executeServerQueryWithSession } from '@/lib/graphql-server'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { Link } from '@/i18n/navigation'
import { localizeHref } from '@/i18n/routing'
import { RouteLoaderTiming } from '@/lib/route-loader-timing'
import { getVerifiedEntryContext } from '@/lib/session'
import { LockKeyhole } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps) {
	const { id, locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: `/competitions/${encodeURIComponent(id)}/manage`,
		titleKey: 'manageTournamentTitle',
		noIndex: true,
	})
}

type PageProps = {
	params: LocaleParams<{ id: string }>
}

export default async function Page({ params }: PageProps) {
	const timing = new RouteLoaderTiming('/competitions/:tournamentId/manage')
	const { id, locale } = await getPageLocale(params)
	const [t, common, context] = await Promise.all([
		getTranslations('TournamentManagePage'),
		getTranslations('Common'),
		timing.measure('session', () => getVerifiedEntryContext())
	])
	const nextPath = `/competitions/${encodeURIComponent(id)}/manage`
	const { session, entryId } = context
	if (!session) {
		timing.finish('redirect-login')
		redirect(
			localizeHref(`/auth/login?next=${encodeURIComponent(nextPath)}`, locale),
		)
	}
	if (!entryId) {
		timing.finish('redirect-bind')
		redirect(
			localizeHref(
				`/onboarding/bind-entry?next=${encodeURIComponent(nextPath)}`,
				locale,
			),
		)
	}

	const tournamentId = /^\d+$/.test(id) ? Number(id) : Number.NaN
	if (!Number.isSafeInteger(tournamentId) || tournamentId <= 0) {
		timing.finish('forbidden')
		return <NoManagementAccess id={id} />
	}

	let response: ManagedTournamentResponse
	try {
		response = await timing.measure('managedTournament', () =>
			executeServerQueryWithSession<ManagedTournamentResponse>(
				session,
				GET_MANAGED_TOURNAMENT,
				{ tournamentId, entryId },
				{ cache: 'no-store' }
			)
		)
	} catch (error) {
		if (
			error instanceof GraphQLRequestError &&
			(error.status === 403 || error.code === 'FORBIDDEN')
		) {
			timing.finish('forbidden')
			return <NoManagementAccess id={id} />
		}
		console.error('[tournament management] Failed to load:', error)
		timing.finish('unavailable')
		return (
			<PageState
				role="alert"
				icon={LockKeyhole}
				title={t('unavailableTitle')}
				description={t('unavailableDescription')}
				actions={
					<>
						<Button asChild>
							<Link href={nextPath}>{common('tryAgain')}</Link>
						</Button>
						<Button variant="outline" asChild>
							<Link href="/competitions/browse">{t('back')}</Link>
						</Button>
					</>
				}
			/>
		)
	}

	const tournament = response.managedTournament
	if (!tournament) {
		timing.finish('forbidden')
		return <NoManagementAccess id={id} />
	}
	timing.finish('ready')

	return (
		<ManageTournamentClient
			key={`${tournament.updatedAt}:${tournament.rosterSyncStatus ?? 'none'}`}
			tournament={tournament}
		/>
	)
}

async function NoManagementAccess({ id }: { id: string }) {
	const t = await getTranslations('TournamentManagePage')
	return (
		<PageState
			role="status"
			icon={LockKeyhole}
			title={t('accessTitle')}
			description={t('accessDescription')}
			actions={
				<>
					<Button asChild>
						<Link href={`/live/competitions/${id}`}>{t('view')}</Link>
					</Button>
					<Button variant="outline" asChild>
						<Link href="/competitions/browse">{t('back')}</Link>
					</Button>
				</>
			}
		/>
	)
}
