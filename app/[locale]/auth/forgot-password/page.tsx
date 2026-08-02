import ForgotPasswordClient from '@/app/auth/forgot-password/ForgotPasswordClient'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/auth/forgot-password',
		titleKey: 'forgotPasswordTitle',
		descriptionKey: 'forgotPasswordDescription',
		noIndex: true,
	})
}

export default async function ForgotPasswordPage({ params }: PageProps) {
	await getPageLocale(params)
	return <ForgotPasswordClient />
}
