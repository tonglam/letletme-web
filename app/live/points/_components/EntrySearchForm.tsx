'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useHydrated } from '@/hooks/use-hydrated'
import type { FormEvent } from 'react'

export function EntrySearchForm({
	value,
	onChange,
	onSubmit,
}: {
	value: string
	onChange: (value: string) => void
	onSubmit: () => void
}) {
	const hydrated = useHydrated()

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		onSubmit()
	}

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row" aria-busy={!hydrated}>
			<div className="sm:max-w-xs sm:flex-1">
				<Label htmlFor="live-points-entry-id" className="sr-only">FPL entry ID</Label>
				<Input
					id="live-points-entry-id"
					type="number"
					inputMode="numeric"
					min={1}
					disabled={!hydrated}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					placeholder="Enter FPL entry ID"
				/>
			</div>
			<Button type="submit" disabled={!hydrated}>View Live Points</Button>
		</form>
	)
}
