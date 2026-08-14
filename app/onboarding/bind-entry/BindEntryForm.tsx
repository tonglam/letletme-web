'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from '@/i18n/navigation'
import { useSession } from '@/lib/auth-client'
import { clearPendingClientQueries } from '@/lib/graphql-client'
import { useTranslations } from 'next-intl'
import { useEffect, useActionState } from 'react'
import { toast } from 'sonner'
import { bindFplEntry } from './actions'

export default function BindEntryForm({ next }: { next: string }) {
	const router = useRouter()
	const t = useTranslations('Onboarding')
	const [state, formAction, isPending] = useActionState(bindFplEntry, null)
	const { refetch: refetchSession } = useSession()

	useEffect(() => {
		if (!(state?.success && state.teamName && state.managerName)) return
		toast.success(t('verified', { teamName: state.teamName, managerName: state.managerName }))
		clearPendingClientQueries()
		void (async () => {
			// Await the session refresh (bypassing better-auth's cookie cache)
			// BEFORE navigating — otherwise the destination page or proxy.ts can
			// still see the pre-bind session for up to five minutes and bounce a
			// newly linked user back here. refetch() never rejects (failures land
			// in its error state), so navigation always proceeds.
			await refetchSession({ query: { disableCookieCache: true } })
			router.push(next)
			// The navbar is a Server Component in the persistent locale layout.
			// Refresh the destination tree so it observes the new FPL binding too.
			router.refresh()
		})()
	}, [state, router, next, t, refetchSession])

	return (
		<form
			action={formAction}
			className="space-y-4"
		>
			{state?.errorCode && (
				<Alert variant="destructive">
					<AlertDescription>{t(`errors.${state.errorCode}`)}</AlertDescription>
				</Alert>
			)}

			<div className="space-y-1">
				<Label htmlFor="entryId">{t('entryId')}</Label>
				<Input
					id="entryId"
					name="entryId"
					type="text"
					required
					placeholder={t('entryPlaceholder')}
					onChange={e => {
						const match = e.target.value.match(/\/entry\/(\d+)/)
						if (match) e.target.value = match[1]
					}}
				/>
			</div>
			<Button type="submit" className="w-full" disabled={isPending}>
				{isPending ? t('linking') : t('linkTeam')}
			</Button>
		</form>
	)
}
