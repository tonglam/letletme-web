import SignupClient from '@/app/auth/signup/SignupClient'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/auth/signup',
		titleKey: 'signupTitle',
		descriptionKey: 'signupDescription',
		noIndex: true,
	})
}

export default async function SignupPage({ params }: PageProps) {
	await getPageLocale(params)
	return <SignupClient />
}
