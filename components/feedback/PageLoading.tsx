'use client'

import {
	RouteLoadingSkeleton,
	type RouteLoadingVariant,
} from '@/components/feedback/RouteLoadingSkeleton'
import { useTranslations } from 'next-intl'

/** Client-safe page loading (i18n label). Prefer RouteLoadingSkeleton in `loading.tsx`. */
export function PageLoading({
	label,
	variant = 'dashboard',
}: {
	label?: string
	variant?: RouteLoadingVariant
}) {
	const t = useTranslations('Common')
	const accessibleLabel = label ?? t('loadingPage')
	return (
		<div aria-label={accessibleLabel}>
			<RouteLoadingSkeleton variant={variant} />
		</div>
	)
}
