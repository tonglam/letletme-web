'use client'

import type { EntryNameSearchHit } from '@/lib/graphql/operations/entries'
import { useTranslations } from 'next-intl'

export default function EntrySearchHits({
	hits,
	onSelect,
}: {
	hits: EntryNameSearchHit[]
	onSelect: (hit: EntryNameSearchHit) => void
}) {
	const t = useTranslations('FplEntryLookup')

	if (hits.length === 0) return null

	return (
		<div className="rounded-lg border surface-inset divide-y">
			<p className="px-3 py-2 text-xs font-medium text-muted-foreground">{t('results')}</p>
			{hits.map(hit => (
				<button
					key={hit.id}
					type="button"
					className="flex w-full min-w-0 items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/50"
					onClick={() => onSelect(hit)}
				>
					<span className="min-w-0">
						<span className="block truncate text-sm font-semibold leading-tight">
							{hit.entryName}
						</span>
						<span className="mt-0.5 block truncate text-xs text-muted-foreground">
							{hit.playerName} · #{hit.id}
						</span>
					</span>
					<span className="shrink-0 text-xs font-semibold text-primary-ink">{t('selectThis')}</span>
				</button>
			))}
		</div>
	)
}
