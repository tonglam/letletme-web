'use client'

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from '@/i18n/navigation'
import { useSession } from '@/lib/auth-client'
import { ClipboardPaste, ExternalLink, Link2Off, MousePointerClick, Pencil, Trophy, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { unlinkFplEntry, updateFplEntry } from './actions'

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
	const [cleared, setCleared] = useState(false)
	const [state, formAction, isPending] = useActionState(updateFplEntry, null)
	const prevStateRef = useRef(state)
	const [unlinking, startUnlink] = useTransition()
	const router = useRouter()
	const { refetch: refetchSession } = useSession()

	useEffect(() => {
		if (state === prevStateRef.current) return
		prevStateRef.current = state

		if (state?.success && state.teamName && state.managerName) {
			toast.success(t('entryVerified', { teamName: state.teamName, managerName: state.managerName }))
			queueMicrotask(() => {
				setCleared(false)
				setEditing(false)
			})
			// Bypass better-auth's 5-min session cookie cache so the header and
			// every useSession() consumer see the new binding immediately.
			void refetchSession({ query: { disableCookieCache: true } })
			router.refresh()
		} else if (state?.errorCode) {
			toast.error(t(`errors.${state.errorCode}`))
		}
	}, [state, router, t, refetchSession])

	const linkedEntryId = currentEntryId ?? (state?.success ? state.newEntryId : null)
	const isLinked = !cleared && (verified || Boolean(state?.success))
	const displayInfo =
		fplInfo ??
		(state?.success && state.teamName && state.managerName
			? { teamName: state.teamName, managerName: state.managerName }
			: null)

	const handleUnlink = () => {
		startUnlink(async () => {
			const result = await unlinkFplEntry()
			if (result.success) {
				setCleared(true)
				setEditing(true)
				toast.success(t('unlinked'))
				void refetchSession({ query: { disableCookieCache: true } })
				router.refresh()
			} else if (result.errorCode) {
				toast.error(t(`errors.${result.errorCode}`))
			}
		})
	}

	if (!editing && isLinked) {
		const title = displayInfo?.teamName ?? `#${linkedEntryId}`
		const subtitle = [
			displayInfo?.managerName,
			displayInfo?.teamName ? `#${linkedEntryId}` : null,
		]
			.filter(Boolean)
			.join(' · ')

		return (
			<div className="flex w-full min-w-0 items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
						<Trophy aria-hidden="true" className="size-5 text-primary-ink" />
					</span>
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<p className="truncate text-sm font-semibold leading-tight">{title}</p>
							<Badge
								variant="outline"
								className="shrink-0 border-success/30 bg-success/10 text-success"
							>
								{t('linked')}
							</Badge>
						</div>
						{subtitle && (
							<p className="truncate text-xs text-muted-foreground mt-0.5">{subtitle}</p>
						)}
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						className="h-7 px-2 text-xs"
						onClick={() => setEditing(true)}
					>
						<Pencil className="h-3 w-3 mr-1" />
						{t('changeEntry')}
					</Button>
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-7 px-2 text-xs text-destructive hover:text-destructive"
							>
								<Link2Off className="h-3 w-3 mr-1" />
								{t('unlink')}
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>{t('unlinkTitle')}</AlertDialogTitle>
								<AlertDialogDescription>
									{t('unlinkConfirm', { entryId: linkedEntryId ?? '—' })}
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
								<AlertDialogAction onClick={handleUnlink} disabled={unlinking}>
									{unlinking ? t('unlinking') : t('unlink')}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</div>
		)
	}

	return (
		<form action={formAction} className="space-y-3">
			{state?.errorCode && <p className="text-sm text-destructive">{t(`errors.${state.errorCode}`)}</p>}

			{isLinked && linkedEntryId && (
				<p className="text-xs text-muted-foreground">
					{t('currentlyLinked', { entryId: linkedEntryId })}
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
						type="text"
						required
						placeholder={t('entryPlaceholder')}
						defaultValue={isLinked ? (linkedEntryId ?? '') : ''}
						className="h-8 text-sm"
						onChange={e => {
							const match = e.target.value.match(/\/entry\/(\d+)/)
							if (match) e.target.value = match[1]
						}}
					/>
				</div>
				<Button type="submit" size="sm" className="h-8" disabled={isPending}>
					{isPending ? t('linking') : t('linkTeam')}
				</Button>
				{isLinked && (
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

			<div className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground space-y-1.5">
				<p>
					{t.rich('findEntryHint', {
						gh: chunks => (
							<span className="inline-flex items-center gap-1 rounded-md border border-primary/50 bg-primary/10 px-1.5 py-0.5 align-baseline font-semibold text-primary-ink">
								<MousePointerClick aria-hidden="true" className="size-3" />
								{chunks}
							</span>
						),
						paste: chunks => (
							<span className="inline-flex items-center gap-1 rounded-md border border-primary/50 bg-primary/10 px-1.5 py-0.5 align-baseline font-semibold text-primary-ink">
								<ClipboardPaste aria-hidden="true" className="size-3" />
								{chunks}
							</span>
						),
					})}
				</p>
				<Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" asChild>
					<a
						href="https://fantasy.premierleague.com/en/my-team"
						target="_blank"
						rel="noopener noreferrer"
					>
						<ExternalLink data-icon="inline-start" />
						{t('openFpl')}
					</a>
				</Button>
			</div>
		</form>
	)
}
