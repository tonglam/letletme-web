'use client'

import { GameweekSelector } from '@/components/data/GameweekSelector'
import RootLayout from '@/components/layout/RootLayout'
import { SearchHeader } from '@/components/tournament/SearchHeader'
import { TournamentHeader } from '@/components/tournament/TournamentHeader'
import { TournamentSelector } from '@/components/tournament/TournamentSelector'
import { TournamentTable } from '@/components/tournament/TournamentTable'
import { Card } from '@/components/ui/card'
import { Tournament } from '@/types/tournament'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

const DEFAULT_TOURNAMENT_ID = 't1'

interface TournamentClientProps {
	tournaments: Tournament[]
}

export default function TournamentClient({
	tournaments
}: TournamentClientProps) {
	const searchParams = useSearchParams()
	const tournamentIdFromUrl =
		searchParams.get('tournamentId') || DEFAULT_TOURNAMENT_ID
	const currentGameweek = 21 // Current gameweek

	const [searchQuery, setSearchQuery] = useState<string>('')
	const [selectedGameweek, setSelectedGameweek] = useState(currentGameweek)

	// Find the current tournament based on the selected ID
	const currentTournament =
		tournaments.find(t => t.id === tournamentIdFromUrl) || tournaments[0]

	return (
		<RootLayout>
			<div className="container max-w-4xl mx-auto px-4 py-8">
				<TournamentSelector
					tournaments={tournaments}
					currentTournamentId={tournamentIdFromUrl}
					onTournamentChange={id => {
						// Handle tournament change
						window.location.href = `/live/tournament?tournamentId=${id}`
					}}
				/>

				<Card className="p-4 mb-6">
					<GameweekSelector
						onGameweekChange={setSelectedGameweek}
						currentGameweek={currentGameweek}
					/>
				</Card>

				<TournamentHeader
					name={currentTournament.name}
					gameweek={selectedGameweek}
					averagePoints={currentTournament.averagePoints}
					highestPoints={currentTournament.highestPoints}
					totalEntries={currentTournament.totalEntries}
				/>

				<SearchHeader
					searchQuery={searchQuery}
					setSearchQuery={setSearchQuery}
				/>

				<TournamentTable
					entries={currentTournament.entries}
					searchQuery={searchQuery}
					tournamentId={tournamentIdFromUrl}
				/>
			</div>
		</RootLayout>
	)
}
