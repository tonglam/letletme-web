'use client'

import { useEffect } from 'react'

const SHELL_READY_EVENT = 'letletme:shell-ready'

/** Enable shell DOM enhancements only after React has hydrated its server markup. */
export function ShellControlsReady() {
	useEffect(() => {
		document.documentElement.setAttribute('data-shell-hydrated', '')
		document.dispatchEvent(new Event(SHELL_READY_EVENT))
	}, [])

	return null
}
