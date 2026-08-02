'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from '@/i18n/navigation'
import { signOut } from '@/lib/auth-client'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

export default function SignOutButton() {
	const router = useRouter()
	const t = useTranslations('Profile')
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
			{pending ? t('signingOut') : t('signOut')}
		</Button>
	)
}
