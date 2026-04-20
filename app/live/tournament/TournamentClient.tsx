'use client'

import { GameweekSelector } from '@/components/data/GameweekSelector'
import RootLayout from '@/components/layout/RootLayout'
import { SearchHeader } from '@/components/tournament/SearchHeader'
import { TournamentHeader } from '@/components/tournament/TournamentHeader'
import { TournamentSelector } from '@/components/tournament/TournamentSelector'
import { TournamentTable } from '@/components/tournament/TournamentTable'
import { Card } from '@/components/ui/card'
import { executeQuery } from '@/lib/graphql-client'
import { GET_CURRENT_AND_NEXT_EVENTS, type EventsResponse } from '@/lib/graphql/queries'
import { Tournament } from '@/types/tournament'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

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

	const [searchQuery, setSearchQuery] = useState<string>('')
	const [currentGameweek, setCurrentGameweek] = useState<number | undefined>(
		undefined
	)
	const [selectedGameweek, setSelectedGameweek] = useState<number | undefined>(
		undefined
	)

	useEffect(() => {
		let isCancelled = false

		const loadCurrentGameweek = async () => {
			try {
				const eventsResponse = await executeQuery<EventsResponse>(
					GET_CURRENT_AND_NEXT_EVENTS
				)
				const currentEventId = eventsResponse.current?.[0]?.id

				if (isCancelled || !currentEventId) {
					return
				}

				setCurrentGameweek(currentEventId)
				setSelectedGameweek(previous => previous ?? currentEventId)
			} catch (error) {
				console.error('Failed to load current gameweek:', error)

				if (isCancelled) {
					return
				}

				const fallbackGameweek = 21
				setCurrentGameweek(fallbackGameweek)
				setSelectedGameweek(previous => previous ?? fallbackGameweek)
			}
		}

		loadCurrentGameweek()

		return () => {
			isCancelled = true
		}
	}, [])

	// Find the current tournament based on the selected ID
	const currentTournament =
		tournaments.find(t => t.id === tournamentIdFromUrl) || tournaments[0]
	const displayGameweek = selectedGameweek ?? currentGameweek ?? 1

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
					{currentGameweek !== undefined ? (
						<GameweekSelector
							onGameweekChange={setSelectedGameweek}
							currentGameweek={currentGameweek}
						/>
					) : (
						<p className="text-sm text-muted-foreground">Loading gameweek...</p>
					)}
				</Card>

				<TournamentHeader
					name={currentTournament.name}
					gameweek={displayGameweek}
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
