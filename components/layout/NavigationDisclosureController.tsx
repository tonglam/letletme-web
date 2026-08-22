'use client'

import { useEffect, type ReactNode } from 'react'

const disclosureSelector = 'details[data-navigation-disclosure]'

function closeOtherDisclosures(except?: HTMLDetailsElement | null) {
	for (const disclosure of Array.from(
		document.querySelectorAll<HTMLDetailsElement>(disclosureSelector)
	)) {
		if (disclosure !== except) disclosure.removeAttribute('open')
	}
}

/**
 * Native details elements do not consistently implement the `name` grouping
 * behavior across browsers. Keep the server-rendered/keyboard-friendly
 * details markup, then add the missing outside-click, Escape, and mutual
 * exclusion behavior once on the client.
 */
export function NavigationDisclosureController({
	children
}: {
	children: ReactNode
}) {
	useEffect(() => {
		const handleClick = (event: MouseEvent) => {
			const target = event.target
			if (!(target instanceof Element)) return
			const disclosure = target.closest<HTMLDetailsElement>(
				disclosureSelector
			)

			if (!disclosure) {
				closeOtherDisclosures()
				return
			}

			// Clicking a summary can open a new menu. Close every other menu while
			// leaving the browser's native toggle for the clicked one intact.
			if (target.closest('summary')) closeOtherDisclosures(disclosure)
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') closeOtherDisclosures()
		}

		document.addEventListener('click', handleClick)
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('click', handleClick)
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [])

	return children
}
