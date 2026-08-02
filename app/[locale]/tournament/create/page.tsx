import CreateTournamentClient from '@/app/tournament/create/CreateTournamentClient'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/tournament/create',
		titleKey: 'createTournamentTitle',
		descriptionKey: 'createTournamentDescription',
	})
}

export default async function CreateTournamentPage({ params }: PageProps) {
	await getPageLocale(params)
	return <CreateTournamentClient />
}
