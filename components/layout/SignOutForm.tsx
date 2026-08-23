'use client'

import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { clearAllLiveBoardLastGood } from '@/lib/tournament/live-board'

export function SignOutForm({
	label,
	pendingLabel,
	errorLabel,
	redirectHref
}: {
	label: string
	pendingLabel: string
	errorLabel: string
	redirectHref: string
}) {
	const [pending, setPending] = useState(false)
	const [error, setError] = useState(false)

	return (
		<form
			action="/api/session/logout"
			method="post"
			onSubmit={async event => {
				event.preventDefault()
				setPending(true)
				setError(false)
				try {
					const response = await fetch('/api/session/logout', {
						method: 'POST',
						headers: { Accept: 'application/json' }
					})
					if (!response.ok) throw new Error('Sign out failed')
					clearAllLiveBoardLastGood()
					window.location.assign(redirectHref)
				} catch {
					setError(true)
					setPending(false)
				}
			}}
		>
			<input type="hidden" name="redirectHref" value={redirectHref} />
			<button
				type="submit"
				disabled={pending}
				className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
			>
				<LogOut aria-hidden="true" className="size-4" />
				{pending ? pendingLabel : label}
			</button>
			{error ? (
				<p role="alert" className="mt-1 px-2 text-xs text-destructive">
					{errorLabel}
				</p>
			) : null}
		</form>
	)
}
