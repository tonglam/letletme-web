'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useActionState } from 'react'
import { toast } from 'sonner'
import { bindFplEntry } from './actions'

export default function BindEntryForm({ next }: { next: string }) {
	const router = useRouter()
	const t = useTranslations('Onboarding')
	const [state, formAction, isPending] = useActionState(bindFplEntry, null)

	useEffect(() => {
		if (state?.success && state.teamName && state.managerName) {
			toast.success(
				t('verified', {
					teamName: state.teamName,
					managerName: state.managerName
				})
			)
			router.push(next)
		}
	}, [state, router, next, t])

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

			{state?.challengeId && state.requiredName ? (
				<>
					<input
						type="hidden"
						name="challengeId"
						value={state.challengeId}
					/>
					<Alert>
						<AlertDescription className="space-y-2">
							<p>{t('changeTeamName', { entryId: state.entryId ?? '—' })}</p>
							<p className="font-mono text-lg font-semibold">
								{state.requiredName}
							</p>
							<p className="text-xs">{t('saveAndConfirm')}</p>
						</AlertDescription>
					</Alert>
					<Button
						type="submit"
						className="w-full"
						disabled={isPending}
					>
						{isPending ? t('checkingFpl') : t('changedVerify')}
					</Button>
				</>
			) : (
				<>
					<div className="space-y-1">
						<Label htmlFor="entryId">{t('entryId')}</Label>
						<Input
							id="entryId"
							name="entryId"
							type="number"
							min={1}
							required
							placeholder={t('entryPlaceholder')}
						/>
					</div>
					<Button
						type="submit"
						className="w-full"
						disabled={isPending}
					>
						{isPending ? t('startingChallenge') : t('verifyOwnership')}
					</Button>
				</>
			)}
		</form>
	)
}
