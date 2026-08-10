'use client'

import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { useTeamGameweekWorkspaceOptional } from '../_lib/team-gameweek-workspace'

interface TeamGameweekLinkProps {
	gameweek: number | string
	className?: string
	/** Visible label; defaults to `GW{n}` */
	children?: ReactNode
}

/**
 * Opens (or focuses) an in-page gameweek tab — explicit button, not middle-click.
 */
export function TeamGameweekLink({
	gameweek,
	className,
	children,
}: TeamGameweekLinkProps) {
	const t = useTranslations('TeamStats')
	const workspace = useTeamGameweekWorkspaceOptional()
	const gw = Number(gameweek)

	if (!Number.isFinite(gw) || gw < 1) {
		return (
			<span className={className}>{children ?? `GW${gameweek}`}</span>
		)
	}

	if (!workspace) {
		return (
			<span className={cn('font-mono tabular-nums', className)}>
				{children ?? `GW${gw}`}
			</span>
		)
	}

	return (
		<button
			type="button"
			className={cn(
				'rounded-sm font-mono tabular-nums text-primary-ink underline-offset-2',
				'hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
				className,
			)}
			aria-label={t('openGameweekResults', { gameweek: gw })}
			onClick={() => workspace.openGameweek(gw)}
		>
			{children ?? `GW${gw}`}
		</button>
	)
}
