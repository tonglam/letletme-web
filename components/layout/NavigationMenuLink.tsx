'use client'

import { Link } from '@/i18n/navigation'
import type { ComponentProps } from 'react'

type NavigationMenuLinkProps = ComponentProps<typeof Link>

/** Close the native mobile disclosure before a normal client navigation. */
export function NavigationMenuLink({
	onClick,
	...props
}: NavigationMenuLinkProps) {
	return (
		<Link
			{...props}
			onClick={event => {
				onClick?.(event)
				if (
					event.defaultPrevented ||
					event.button !== 0 ||
					event.metaKey ||
					event.ctrlKey ||
					event.shiftKey ||
					event.altKey
				) {
					return
				}
				const disclosure = event.currentTarget.closest(
					'details[data-navigation-mobile]'
				) as HTMLDetailsElement | null
				disclosure?.removeAttribute('open')
			}}
		/>
	)
}
