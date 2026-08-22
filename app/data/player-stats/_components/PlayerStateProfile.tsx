'use client'

import { Skeleton } from '@/components/ui/skeleton'
import type {
	PlayerDetailData,
	PlayerStateProfileData
} from '@/lib/graphql/operations/players'
import { useTranslations } from 'next-intl'
import { PlayerStatsSection } from './PlayerStatsSection'
import { PlayerStateProfileContent } from './PlayerStateSections'

export function PlayerStateProfile({
	player,
	comparison,
	profile,
	comparisonProfile,
	seasonStatsAvailable,
	statusMessage,
	isLoading,
	isComparisonLoading,
	error,
	comparisonError
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData | null
	profile: PlayerStateProfileData | null
	comparisonProfile: PlayerStateProfileData | null
	seasonStatsAvailable: boolean
	statusMessage: string | null
	isLoading: boolean
	isComparisonLoading: boolean
	error: string | null
	comparisonError: string | null
}) {
	const t = useTranslations('PlayerStats.playerState')

	if (!seasonStatsAvailable) {
		return (
			<PlayerStatsSection
				id="ps-state"
				title={t('notRatedTitle')}
				hint={statusMessage ?? t('notRatedHint')}
			>
				<p className="rounded-lg border border-border/60 px-3 py-3 text-sm text-muted-foreground">
					{statusMessage ?? t('notRatedHint')}
				</p>
			</PlayerStatsSection>
		)
	}

	if (isLoading || (comparison && isComparisonLoading)) {
		return (
			<PlayerStatsSection
				id="ps-state"
				title={t('title')}
				hint={t('hint')}
			>
				<Skeleton className="h-28 w-full rounded-lg" />
			</PlayerStatsSection>
		)
	}

	if (!profile) {
		return (
			<PlayerStatsSection
				id="ps-state"
				title={t('title')}
				hint={t('hint')}
			>
				<p className="rounded-lg border border-border/60 px-4 py-4 text-sm text-muted-foreground">
					{error ?? comparisonError ?? t('unavailable')}
				</p>
			</PlayerStatsSection>
		)
	}

	return (
		<PlayerStateProfileContent
			player={player}
			comparison={comparison}
			profile={profile}
			comparisonProfile={comparisonProfile}
			comparisonError={comparisonError}
		/>
	)
}

export { PlayerStateContext } from './PlayerStateSections'
