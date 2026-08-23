import { Link } from '@/i18n/navigation'
import type { ComponentProps } from 'react'

type NavigationMenuLinkProps = ComponentProps<typeof Link>

/** The shell bootstrap closes the containing native disclosure on navigation. */
export function NavigationMenuLink(props: NavigationMenuLinkProps) {
	return <Link {...props} />
}
