'use client'

import { DeltaBadge } from '@/components/data/DeltaBadge'
import type {
	PlayerDetailData,
	PlayerStateProfileData
} from '@/lib/graphql/operations/players'
import { useTranslations } from 'next-intl'
import { PlayerSeasonTimeline } from './PlayerSeasonTimeline'
import { formatPrice, formatPriceDiff } from './PlayerStatPrimitives'

export function PlayerOverallCard({
	player,
	comparison,
	profile,
	comparisonProfile,
	anchorGw
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData | null
	profile: PlayerStateProfileData | null
	comparisonProfile: PlayerStateProfileData | null
	anchorGw: number
}) {
	return (
		<PlayerSeasonTimeline
			player={player}
			comparison={comparison}
			profile={profile}
			comparisonProfile={comparisonProfile}
			anchorGw={anchorGw}
		/>
	)
}

export function StickyPlayerIdentity({
	player,
	comparison
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData | null
}) {
	const t = useTranslations('PlayerStats')
	const priceDiff = formatPriceDiff(player.price, player.startPrice)

	return (
		<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
			<span className="font-display font-bold uppercase tracking-wide">
				{player.webName}
			</span>
			<span className="text-muted-foreground">{player.teamShortName}</span>
			<span className="tabular-nums font-medium">
				{formatPrice(player.price)}
				{priceDiff ? (
					<DeltaBadge
						value={player.price - player.startPrice}
						showArrow={false}
						format={() => priceDiff}
						size="sm"
						className="ml-1 text-xs"
					/>
				) : null}
			</span>
			{comparison ? (
				<>
					<span className="text-muted-foreground">{t('versus')}</span>
					<span className="font-display font-bold uppercase tracking-wide">
						{comparison.webName}
					</span>
					<span className="text-muted-foreground">
						{comparison.teamShortName}
					</span>
				</>
			) : null}
		</div>
	)
}
