import { notFound, redirect } from 'next/navigation'
import { getPageLocale, type LocaleParams } from '@/i18n/page'
import { localizeHref } from '@/i18n/routing'

export const dynamic = 'force-dynamic'

type PageProps = {
	params: LocaleParams<{ id: string }>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ params, searchParams }: PageProps) {
	const { id, locale } = await getPageLocale(params)
	if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
		notFound()
	}
	const query = await searchParams
	const created = query.created === '1' ? '?created=1' : ''
	redirect(localizeHref(`/live/tournaments/${id}${created}`, locale))
}
