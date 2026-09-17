import { notFound } from 'next/navigation'
import { getPageLocale, type LocaleParams } from '@/i18n/page'

export const dynamic = 'force-dynamic'

// An explicit rewrite destination keeps invalid routes inside the locale layout
// on both standalone and hosted deployments.
export default async function Page({ params }: { params: LocaleParams }) {
 await getPageLocale(params)
 notFound()
}
