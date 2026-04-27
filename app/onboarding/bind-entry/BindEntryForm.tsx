'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import { useEffect, useActionState } from 'react'
import { toast } from 'sonner'
import { bindFplEntry } from './actions'

export default function BindEntryForm() {
	const router = useRouter()
	const [state, formAction, isPending] = useActionState(bindFplEntry, null)

	useEffect(() => {
		if (state?.success) {
			toast.success(state.success)
			router.push('/')
		}
	}, [state, router])

	return (
		<form action={formAction} className="space-y-4">
			{state?.error && (
				<Alert
					variant="destructive"
					className="bg-red-50 text-red-800 border-red-200"
				>
					<AlertDescription>{state.error}</AlertDescription>
				</Alert>
			)}

			<div className="space-y-1">
				<Label htmlFor="entryId">FPL Entry ID</Label>
				<Input
					id="entryId"
					name="entryId"
					type="number"
					min={1}
					required
					placeholder="e.g. 123456"
				/>
			</div>

			<Button type="submit" className="w-full" disabled={isPending}>
				{isPending ? 'Verifying…' : 'Link team'}
			</Button>
		</form>
	)
}
