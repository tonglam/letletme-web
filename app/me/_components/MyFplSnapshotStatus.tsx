'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Link } from '@/i18n/navigation'
import type { MyFplSnapshotMeta } from '@/lib/graphql/operations/my-fpl'
import { AlertCircle } from 'lucide-react'
import { useHydrated } from '@/hooks/use-hydrated'
import { useFormatter, useTranslations } from 'next-intl'

type MyFplSnapshotStatusProps = {
	meta: MyFplSnapshotMeta
	liveHref?: string
	className?: string
}

const formatDate = (
	raw: string,
	fallback: string,
	format: ReturnType<typeof useFormatter>,
	hydrated: boolean
): string => {
	const value = new Date(raw)
	if (!Number.isFinite(value.getTime())) return fallback
	const timeZone = hydrated
		? Intl.DateTimeFormat().resolvedOptions().timeZone
		: 'UTC'
	const label = format.dateTime(value, {
		dateStyle: 'medium',
		timeStyle: 'medium',
		timeZone
	})
	return `${label} (${timeZone})`
}

/**
 * One status surface for Team and Competitions. The data itself remains the
 * same coherent snapshot; this component only explains settlement, coverage,
 * timeliness and the optional Live hand-off.
 */
export function MyFplSnapshotStatus({
	meta,
	liveHref,
	className = 'mb-6'
}: MyFplSnapshotStatusProps) {
	const t = useTranslations('MyFplSnapshot')
	const format = useFormatter()
	const hydrated = useHydrated()
	const isDelayed = meta.settlementState === 'DELAYED'
	const due = meta.finalizationDueAt
		? formatDate(meta.finalizationDueAt, meta.snapshotDate, format, hydrated)
		: null
	const message =
		meta.settlementState === 'FINAL'
			? t('final', {
					cutoff: formatDate(
						meta.sourceMaxCheckedAt,
						meta.snapshotDate,
						format,
						hydrated
					),
					published: formatDate(meta.publishedAt, meta.snapshotDate, format, hydrated)
				})
			: meta.settlementState === 'FINALIZING'
				? due
					? t('finalizing', { due })
					: t('finalizingNoDue')
				: meta.settlementState === 'DELAYED'
					? due
						? t('delayed', { due })
						: t('delayedNoDue')
				: t('provisional', {
							cutoff: formatDate(
								meta.sourceMaxCheckedAt,
								meta.snapshotDate,
								format,
								hydrated
							),
							published: formatDate(meta.publishedAt, meta.snapshotDate, format, hydrated)
						})

	return (
		<Alert
			className={className}
			variant={isDelayed ? 'destructive' : 'default'}
		>
			{isDelayed ? <AlertCircle aria-hidden="true" /> : null}
			<AlertDescription>
				{message} {meta.timelinessState === 'STALE' ? t('stale') : null}
				{meta.coverageState === 'CORRECTION_PENDING'
					? ` ${t('coverageCorrection', {
							observed: meta.observedEntryCount,
							expected: meta.expectedEntryCount
						})}`
					: null}
				{meta.settlementState === 'PROVISIONAL' && liveHref ? (
					<Link
						href={liveHref}
						className="ml-2 font-semibold text-primary-ink underline-offset-4 hover:underline"
					>
						{t('openLive')}
					</Link>
				) : null}
			</AlertDescription>
		</Alert>
	)
}
