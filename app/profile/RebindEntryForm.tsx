'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pencil, X } from 'lucide-react'
	import { useActionState, useEffect, useRef, useState } from 'react'
	import { useRouter } from 'next/navigation'
	import { toast } from 'sonner'
import { updateFplEntry } from './actions'

export default function RebindEntryForm({
	currentEntryId,
	fplInfo,
}: {
	currentEntryId: number | null | undefined
	fplInfo: { teamName: string; managerName: string } | null
}) {
	const [editing, setEditing] = useState(!currentEntryId)
	const [state, formAction, isPending] = useActionState(updateFplEntry, null)
	const prevStateRef = useRef(state)
	const router = useRouter()

	useEffect(() => {
		if (state === prevStateRef.current) return
		prevStateRef.current = state

		if (state?.success) {
			toast.success(state.success)
			queueMicrotask(() => setEditing(false))
			router.refresh()
		} else if (state?.error) {
			toast.error(state.error)
		}
	}, [state, router])

	if (!editing) {
		return (
			<div className="flex w-full min-w-0 items-center justify-between gap-3">
				<div className="flex flex-col gap-0.5">
					<div className="flex items-center gap-2">
						<span className="text-sm font-mono font-medium">{currentEntryId ?? state?.newEntryId}</span>
						<span className="text-xs text-muted-foreground">linked</span>
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
					Change
				</Button>
			</div>
		)
	}

	return (
		<form action={formAction} className="space-y-3">
			{currentEntryId && (
				<p className="text-xs text-muted-foreground">
					Currently linked to <span className="font-mono font-medium">{currentEntryId}</span>
				</p>
			)}

			<div className="flex gap-2 items-end">
				<div className="flex-1 space-y-1">
					<Label htmlFor="entryId" className="text-xs">
						New FPL Entry ID
					</Label>
					<Input
						id="entryId"
						name="entryId"
						type="number"
						min={1}
						required
						placeholder="e.g. 123456"
						defaultValue={currentEntryId ?? ''}
						className="h-8 text-sm"
					/>
				</div>
				<Button type="submit" size="sm" className="h-8" disabled={isPending}>
					{isPending ? 'Saving…' : 'Save'}
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
		</form>
	)
}
