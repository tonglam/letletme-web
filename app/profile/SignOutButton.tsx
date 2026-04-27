'use client'

import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function SignOutButton() {
	const router = useRouter()
	const [pending, setPending] = useState(false)

	const handleSignOut = async () => {
		setPending(true)
		try {
			await signOut()
			router.push('/')
			router.refresh()
		} finally {
			setPending(false)
		}
	}

	return (
		<Button variant="destructive" className="w-full" disabled={pending} onClick={handleSignOut}>
			{pending ? 'Signing out…' : 'Sign out'}
		</Button>
	)
}
