import LoginClient from '@/app/auth/login/LoginClient'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/auth/login',
		titleKey: 'loginTitle',
		descriptionKey: 'loginDescription',
		noIndex: true,
	})
}

export default async function LoginPage({ params }: PageProps) {
	await getPageLocale(params)
	return <LoginClient />
}
