'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import EntrySearchHits from '@/components/fpl/EntrySearchHits'
import { useEntryNameSearch } from '@/components/fpl/useEntryNameSearch'
import { useRouter } from '@/i18n/navigation'
import { useSession } from '@/lib/auth-client'
import { classifyEntryLookupInput } from '@/lib/fpl-binding-core'
import { clearPendingClientQueries } from '@/lib/graphql-client'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useActionState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { bindFplEntry } from './actions'

export default function BindEntryForm({ next }: { next: string }) {
	const router = useRouter()
	const t = useTranslations('Onboarding')
	const lookup = useTranslations('FplEntryLookup')
	const [state, formAction, isPending] = useActionState(bindFplEntry, null)
	const { refetch: refetchSession } = useSession()
	const inputRef = useRef<HTMLInputElement>(null)
	const { hits, errorKey, searching, search, clear } = useEntryNameSearch()

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

	const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
		const raw = inputRef.current?.value ?? ''
		if (classifyEntryLookupInput(raw).kind === 'id') {
			clear()
			return
		}
		event.preventDefault()
		const result = await search(raw)
		if (result.mode === 'searched' && result.hits.length === 1 && inputRef.current) {
			inputRef.current.value = String(result.hits[0].id)
		}
	}

	return (
		<form
			action={formAction}
			onSubmit={onSubmit}
			className="space-y-4"
		>
			{state?.errorCode && (
				<Alert variant="destructive">
					<AlertDescription>{t(`errors.${state.errorCode}`)}</AlertDescription>
				</Alert>
			)}
			{errorKey && (
				<p className="text-sm text-destructive">{lookup(`errors.${errorKey}`)}</p>
			)}

			<div className="space-y-1">
				<Label htmlFor="entryId">{t('entryId')}</Label>
				<Input
					ref={inputRef}
					id="entryId"
					name="entryId"
					type="text"
					required
					placeholder={t('entryPlaceholder')}
					onChange={e => {
						const match = e.target.value.match(/\/entry\/(\d+)/)
						if (match) e.target.value = match[1]
						clear()
					}}
				/>
			</div>
			<EntrySearchHits
				hits={hits}
				onSelect={hit => {
					if (inputRef.current) inputRef.current.value = String(hit.id)
					clear()
				}}
			/>
			<Button type="submit" className="w-full" disabled={isPending || searching}>
				{searching ? lookup('searching') : isPending ? t('linking') : t('linkTeam')}
			</Button>
		</form>
	)
}
