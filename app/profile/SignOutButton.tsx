'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from '@/i18n/navigation'
import { signOut } from '@/lib/auth-client'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

export default function SignOutButton() {
	const router = useRouter()
	const t = useTranslations('Profile')
	const [pending, setPending] = useState(false)

	const handleSignOut = async () => {
		setPending(true)
		try {
			const { error } = await signOut()
			if (error) {
				toast.error(t('errors.signOutFailed'))
				return
			}
			router.push('/')
			router.refresh()
		} catch {
			toast.error(t('errors.signOutFailed'))
		} finally {
			setPending(false)
		}
	}

	return (
		<Button
			variant="destructive"
			className="w-full"
			disabled={pending}
			onClick={handleSignOut}
		>
			{pending ? t('signingOut') : t('signOut')}
		</Button>
	)
}
