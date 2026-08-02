'use client'

import { Card } from '@/components/ui/card'
import type { Match } from '@/types/match'
import { memo, useMemo } from 'react'
import { PlayerDetailModal } from './PlayerDetailModal'
import { MatchHeader } from './match-card/MatchHeader'
import { MatchHighlights } from './match-card/MatchHighlights'
import { MatchNavigation } from './match-card/MatchNavigation'
import { MatchPlayerList } from './match-card/MatchPlayerList'
import { buildMatchHighlights, isMatchStarted } from './match-card/match-card-model'
import { useMatchPlayerDetail } from './match-card/useMatchPlayerDetail'

interface MatchCardProps {
	match: Match
	allMatches?: Match[]
	currentIndex?: number
	eventId?: number
}

function MatchCardComponent({ match, allMatches, currentIndex, eventId }: MatchCardProps) {
	const highlights = useMemo(() => buildMatchHighlights(match), [match])
	const detail = useMatchPlayerDetail(eventId)

	return (
		<Card data-match-id={match.id} className="relative overflow-hidden p-4 md:p-6">
			<MatchNavigation allMatches={allMatches} currentIndex={currentIndex} />
			<div className="flex flex-col gap-6">
				<MatchHeader match={match} />
				<MatchHighlights groups={highlights} />
				{isMatchStarted(match) ? (
					<MatchPlayerList match={match} onSelectPlayer={detail.openPlayerDetail} />
				) : null}
			</div>
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
