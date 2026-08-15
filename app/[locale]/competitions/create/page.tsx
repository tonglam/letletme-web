import CreateTournamentClient from '@/app/tournament/create/CreateTournamentClient'
import { RouteIntlProvider } from '@/components/i18n/RouteIntlProvider'
import { ROUTE_CLIENT_NAMESPACES } from '@/i18n/client-namespaces'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/competitions/create',
		titleKey: 'createCompetitionTitle',
		descriptionKey: 'createCompetitionDescription',
	})
}

export default async function CreateTournamentPage({ params }: PageProps) {
	await getPageLocale(params)
	return <RouteIntlProvider namespaces={ROUTE_CLIENT_NAMESPACES.competitionsCreate}><CreateTournamentClient /></RouteIntlProvider>
}
