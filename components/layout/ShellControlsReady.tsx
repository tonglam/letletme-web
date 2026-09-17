'use client'

import { useEffect } from 'react'

const SHELL_READY_EVENT = 'letletme:shell-ready'

declare global {
	interface Window {
		__letletmeShellBootstrapped?: boolean
	}
}

/** Enable shell DOM enhancements only after React has hydrated its server markup. */
export function ShellControlsReady() {
	useEffect(() => {
		// Error-document recovery may render the layout without executing Next's
		// beforeInteractive queue. Initialize the same shell script in that case.
		if (!window.__letletmeShellBootstrapped && !document.querySelector('[data-shell-recovery-script]')) {
			const script = document.createElement('script')
			script.src = '/theme-bootstrap.js'
			script.setAttribute('data-cfasync', 'false')
			script.setAttribute('data-shell-recovery-script', '')
			document.head.append(script)
		}
		document.documentElement.setAttribute('data-shell-hydrated', '')
		document.dispatchEvent(new Event(SHELL_READY_EVENT))
	}, [])

	return null
}
