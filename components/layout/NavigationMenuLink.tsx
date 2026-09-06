import { localizeHref, type AppLocale } from '@/i18n/routing'
import { getLocale } from 'next-intl/server'
import type { ComponentProps } from 'react'

type NavigationMenuLinkProps = Omit<ComponentProps<'a'>, 'href'> & {
	href: string
	prefetch?: boolean
}

/** Keep top-level shell navigation on native browser navigation. */
export async function NavigationMenuLink({
	href,
	prefetch: _prefetch,
	...props
}: NavigationMenuLinkProps) {
	const locale = await getLocale()
	return <a href={localizeHref(href, locale as AppLocale)} {...props} />
}
