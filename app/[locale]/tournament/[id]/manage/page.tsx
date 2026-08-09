import ManageTournamentClient from '@/app/tournament/[id]/manage/ManageTournamentClient'
import { PageState } from '@/components/feedback/PageState'
import { Button } from '@/components/ui/button'
import {
	GET_MANAGED_TOURNAMENT,
	type ManagedTournamentResponse,
} from '@/lib/graphql/operations/tournaments'
import { executeServerQuery } from '@/lib/graphql-server'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { Link } from '@/i18n/navigation'
import { localizeHref } from '@/i18n/routing'
import { getCurrentEntryId, getCurrentSession } from '@/lib/session'
import { LockKeyhole } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps) {
	const { id, locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: `/tournament/${encodeURIComponent(id)}/manage`,
		titleKey: 'manageTournamentTitle',
		noIndex: true,
	})
}

type PageProps = {
	params: LocaleParams<{ id: string }>
}

export default async function Page({ params }: PageProps) {
	const { id, locale } = await getPageLocale(params)
	const t = await getTranslations('TournamentManagePage')
	const common = await getTranslations('Common')
	const nextPath = `/tournament/${encodeURIComponent(id)}/manage`
	const session = await getCurrentSession()
	if (!session)
		redirect(
			localizeHref(`/auth/login?next=${encodeURIComponent(nextPath)}`, locale),
		)

	const entryId = await getCurrentEntryId()
	if (!entryId)
		redirect(
			localizeHref(
				`/onboarding/bind-entry?next=${encodeURIComponent(nextPath)}`,
				locale,
			),
		)

	const tournamentId = /^\d+$/.test(id) ? Number(id) : Number.NaN
	if (!Number.isSafeInteger(tournamentId) || tournamentId <= 0) {
		return <NoManagementAccess id={id} />
	}

	let response: ManagedTournamentResponse
	try {
		response = await executeServerQuery<ManagedTournamentResponse>(
			GET_MANAGED_TOURNAMENT,
			{ tournamentId, entryId },
			{ cache: 'no-store' },
		)
	} catch (error) {
		console.error('[tournament management] Failed to load:', error)
		return (
			<PageState
				icon={LockKeyhole}
				title={t('unavailableTitle')}
				description={t('unavailableDescription')}
				actions={
					<>
						<Button asChild>
							<Link href={nextPath}>{common('tryAgain')}</Link>
						</Button>
						<Button variant="outline" asChild>
							<Link href="/tournament/browse">{t('back')}</Link>
						</Button>
					</>
				}
			/>
		)
	}

	const tournament = response.managedTournament
	if (!tournament) {
		return <NoManagementAccess id={id} />
	}

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
			icon={LockKeyhole}
			title={t('accessTitle')}
			description={t('accessDescription')}
			actions={
				<>
					<Button asChild>
						<Link href={`/live/tournaments/${id}`}>{t('view')}</Link>
					</Button>
					<Button variant="outline" asChild>
						<Link href="/tournament/browse">{t('back')}</Link>
					</Button>
				</>
			}
		/>
	)
}
