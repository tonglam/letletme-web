'use client'

import { Card } from '@/components/ui/card'
import { ShareTextFallback } from '@/components/share/ShareTextFallback'
import type { Match } from '@/types/match'
import { memo, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { PlayerDetailModal } from './PlayerDetailModal'
import { MatchHeader } from './match-card/MatchHeader'
import { MatchHighlights } from './match-card/MatchHighlights'
import { MatchNavigation } from './match-card/MatchNavigation'
import { MatchPlayerList } from './match-card/MatchPlayerList'
import { MatchShareButton } from './match-card/MatchShareButton'
import { buildMatchHighlights, isMatchStarted } from './match-card/match-card-model'
import { useMatchPlayerDetail } from './match-card/useMatchPlayerDetail'

interface MatchCardProps {
	match: Match
	allMatches?: Match[]
	currentIndex?: number
	eventId?: number
}

function statusEdgeClass(status: Match['status']): string {
	switch (status) {
		case 'LIVE':
			return 'border-l-destructive'
		case 'HT':
			return 'border-l-warning'
		case 'FT':
			return 'border-l-muted-foreground/40'
		case 'NOT_STARTED':
			return 'border-l-warning/70'
		case 'UPCOMING':
			return 'border-l-info/70'
		default:
			return 'border-l-border'
	}
}

function MatchCardComponent({
	match,
	allMatches,
	currentIndex,
	eventId,
}: MatchCardProps) {
	const highlights = useMemo(() => buildMatchHighlights(match), [match])
	const detail = useMatchPlayerDetail(eventId)
	const t = useTranslations('LiveMatches')
	const [manualShareText, setManualShareText] = useState<string | null>(null)

	return (
		<Card
			data-match-id={match.id}
			className={`relative overflow-hidden border-border/80 border-l-[3px] p-4 shadow-sm md:p-5 ${statusEdgeClass(match.status)}`}
		>
			<div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 sm:right-4 sm:top-4">
				<MatchShareButton
					match={match}
					onManualShareTextChange={setManualShareText}
				/>
				<MatchNavigation
					allMatches={allMatches}
					currentIndex={currentIndex}
				/>
			</div>
			<div className="flex flex-col gap-5">
				<MatchHeader match={match} />
				<MatchHighlights groups={highlights} />
				{isMatchStarted(match) ? (
					<MatchPlayerList
						match={match}
						onSelectPlayer={detail.openPlayerDetail}
					/>
				) : null}
			</div>
			{manualShareText ? (
				<ShareTextFallback
					text={manualShareText}
					message={t('shareCopyUnsupported')}
					fieldLabel={t('shareCopyManualLabel')}
					closeLabel={t('shareCopyClose')}
					onClose={() => setManualShareText(null)}
				/>
			) : null}
			<PlayerDetailModal
				player={detail.selectedPlayer}
				isOpen={detail.isOpen}
				onClose={detail.closePlayerDetail}
				isLoading={detail.isLoading}
			/>
		</Card>
	)
}

MatchCardComponent.displayName = 'MatchCard'

export const MatchCard = memo(MatchCardComponent)
