'use client'

import { Card } from '@/components/ui/card'
import { ShareTextFallback } from '@/components/share/ShareTextFallback'
import type { Match } from '@/types/match'
import { useTranslations } from 'next-intl'
import { memo, useMemo, useRef, useState } from 'react'
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
	showShareActions?: boolean
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
	showShareActions = true,
}: MatchCardProps) {
	const highlights = useMemo(() => buildMatchHighlights(match), [match])
	const detail = useMatchPlayerDetail(eventId)
	const shareRef = useRef<HTMLDivElement | null>(null)
	const shareT = useTranslations('Share')
	const [manualShareText, setManualShareText] = useState<string | null>(null)

	return (
		<Card
			ref={shareRef}
			data-match-id={match.id}
			data-live-match-card="true"
			data-share-preserve-width="true"
			data-share-fit-content="true"
			className={`relative overflow-hidden border-l-[3px] p-4 shadow-sm md:p-5 ${statusEdgeClass(match.status)}`}
		>
			<div
				data-share-exclude="true"
				className="absolute right-3 top-3 z-10 flex items-center gap-1.5 sm:right-4 sm:top-4"
			>
				{showShareActions ? (
						<MatchShareButton
							match={match}
							imageRef={shareRef}
							onTextFallback={setManualShareText}
							onTextFallbackClear={() => setManualShareText(null)}
						/>
				) : null}
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
				<div data-share-exclude="true">
					<ShareTextFallback
						text={manualShareText}
						message={shareT('shareUnsupported')}
						fieldLabel={shareT('shareManualLabel')}
						closeLabel={shareT('shareClose')}
						onClose={() => setManualShareText(null)}
					/>
				</div>
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
