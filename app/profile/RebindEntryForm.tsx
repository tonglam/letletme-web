'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from '@/i18n/navigation'
import { Pencil, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { updateFplEntry } from './actions'

export default function RebindEntryForm({
	currentEntryId,
	verified,
	fplInfo,
}: {
	currentEntryId: number | null | undefined
	verified: boolean
	fplInfo: { teamName: string; managerName: string } | null
}) {
	const t = useTranslations('Profile')
	const [editing, setEditing] = useState(!currentEntryId || !verified)
	const [state, formAction, isPending] = useActionState(updateFplEntry, null)
	const prevStateRef = useRef(state)
	const router = useRouter()

	useEffect(() => {
		if (state === prevStateRef.current) return
		prevStateRef.current = state

		if (state?.success && state.teamName && state.managerName) {
			toast.success(t('entryVerified', { teamName: state.teamName, managerName: state.managerName }))
			queueMicrotask(() => setEditing(false))
			router.refresh()
		} else if (state?.errorCode) {
			toast.error(t(`errors.${state.errorCode}`))
		}
	}, [state, router, t])

	if (!editing && verified) {
		return (
			<div className="flex w-full min-w-0 items-center justify-between gap-3">
				<div className="flex flex-col gap-0.5">
					<div className="flex items-center gap-2">
						<span className="text-sm font-mono font-medium">{currentEntryId ?? state?.newEntryId}</span>
						<span className="text-xs text-muted-foreground">{t('linked')}</span>
					</div>
					{fplInfo && (
						<span className="text-xs text-muted-foreground">
							{fplInfo.teamName} · {fplInfo.managerName}
						</span>
					)}
				</div>
				<Button
					variant="ghost"
					size="sm"
					className="h-7 px-2 text-xs"
					onClick={() => setEditing(true)}
				>
					<Pencil className="h-3 w-3 mr-1" />
					{t('changeEntry')}
				</Button>
			</div>
		)
	}

	return (
		<form action={formAction} className="space-y-3">
			{state?.errorCode && <p className="text-sm text-destructive">{t(`errors.${state.errorCode}`)}</p>}
			{state?.challengeId && state.requiredName ? (
				<>
					<input type="hidden" name="challengeId" value={state.challengeId} />
					<div className="rounded-md border p-3 text-sm space-y-2">
						<p>{t('changeExactName', { entryId: state.newEntryId ?? '—' })}</p>
						<p className="font-mono text-base font-semibold">{state.requiredName}</p>
						<p className="text-xs text-muted-foreground">{t('saveAndVerify')}</p>
					</div>
					<Button type="submit" size="sm" disabled={isPending}>
						{isPending ? t('checking') : t('verifyChangedName')}
					</Button>
				</>
			) : (
				<>
			{currentEntryId && (
				<p className="text-xs text-muted-foreground">
					{t('currentlyLinked', { entryId: currentEntryId })}
				</p>
			)}

			<div className="flex gap-2 items-end">
				<div className="flex-1 space-y-1">
					<Label htmlFor="entryId" className="text-xs">
						{t('newEntryId')}
					</Label>
					<Input
						id="entryId"
						name="entryId"
						type="number"
						min={1}
						required
						placeholder={t('entryPlaceholder')}
						defaultValue={currentEntryId ?? ''}
						className="h-8 text-sm"
					/>
				</div>
				<Button type="submit" size="sm" className="h-8" disabled={isPending}>
					{isPending ? t('starting') : t('startVerification')}
				</Button>
				{currentEntryId && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 px-2"
						onClick={() => setEditing(false)}
					>
						<X className="h-4 w-4" />
					</Button>
				)}
			</div>
				</>
			)}
		</form>
	)
}
