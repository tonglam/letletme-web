import VerifyEmailClient from '@/app/auth/verify-email/VerifyEmailClient'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/auth/verify-email',
		titleKey: 'verifyEmailTitle',
		descriptionKey: 'verifyEmailDescription',
		noIndex: true,
	})
}

export default async function VerifyEmailPage({ params }: PageProps) {
	await getPageLocale(params)
	return <VerifyEmailClient />
}
