import LoginClient from '@/app/auth/login/LoginClient'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { getSafeInternalHref } from '@/i18n/routing'

type LoginSearchParams = Record<string, string | string[] | undefined>

type PageProps = {
	params: LocaleParams
	searchParams: Promise<LoginSearchParams>
}

function firstValue(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value
}

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

export default async function LoginPage({ params, searchParams }: PageProps) {
	await getPageLocale(params)
	const query = await searchParams
	const next = getSafeInternalHref(firstValue(query.next) ?? '/')
	const reason = firstValue(query.reason) === 'reauth' ? 'reauth' : null
	const oauthError = 'oauthError' in query || 'error' in query

	return (
		<LoginClient
			next={next}
			oauthError={oauthError}
			reason={reason}
		/>
	)
}
