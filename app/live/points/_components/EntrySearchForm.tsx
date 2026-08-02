'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useHydrated } from '@/hooks/use-hydrated'
import { useTranslations } from 'next-intl'
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
	const t = useTranslations('LivePoints')

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		onSubmit()
	}

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row" aria-busy={!hydrated}>
			<div className="sm:max-w-xs sm:flex-1">
				<Label htmlFor="live-points-entry-id" className="sr-only">{t('entryId')}</Label>
				<Input
					id="live-points-entry-id"
					type="number"
					inputMode="numeric"
					min={1}
					disabled={!hydrated}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					placeholder={t('entryPlaceholder')}
				/>
			</div>
			<Button type="submit" disabled={!hydrated}>{t('view')}</Button>
		</form>
	)
}
