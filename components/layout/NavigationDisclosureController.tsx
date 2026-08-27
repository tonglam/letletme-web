import type { ReactNode } from 'react'

/**
 * Keep navigation markup server-rendered. The external shell bootstrap owns
 * the small delegated interaction layer without hydrating this subtree.
 */
export function NavigationDisclosureController({
	children
}: {
	children: ReactNode
}) {
	return children
}
