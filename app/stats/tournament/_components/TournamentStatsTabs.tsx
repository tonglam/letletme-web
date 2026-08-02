import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Crown, Star, Trophy } from 'lucide-react'
import type { StandingRow, TournamentStatsViewModel } from '../_lib/tournament-stats-model'
import { TournamentCaptainsTab } from './TournamentCaptainsTab'
import { TournamentChipsTab } from './TournamentChipsTab'
import { TournamentStandingsTab } from './TournamentStandingsTab'

interface TournamentStatsTabsProps {
	filteredStandings: StandingRow[]
	onSearchChange: (value: string) => void
	search: string
	stats: TournamentStatsViewModel
}

export function TournamentStatsTabs({ filteredStandings, onSearchChange, search, stats }: TournamentStatsTabsProps) {
	return (
		<Tabs defaultValue="standings" className="flex flex-col gap-6">
			<TabsList className="grid h-auto w-full grid-cols-3">
				<TabsTrigger value="standings" className="gap-2">
					<Trophy data-icon="inline-start" aria-hidden="true" /> Standings
				</TabsTrigger>
				<TabsTrigger value="captains" className="gap-2">
					<Crown data-icon="inline-start" aria-hidden="true" /> Captains
				</TabsTrigger>
				<TabsTrigger value="chips" className="gap-2">
					<Star data-icon="inline-start" aria-hidden="true" /> Chips
				</TabsTrigger>
			</TabsList>
			<TabsContent value="standings" className="mt-0">
				<Card className="p-6">
					<TournamentStandingsTab rows={filteredStandings} search={search} onSearchChange={onSearchChange} />
				</Card>
			</TabsContent>
			<TabsContent value="captains" className="mt-0"><TournamentCaptainsTab rows={stats.captainStats} /></TabsContent>
			<TabsContent value="chips" className="mt-0"><TournamentChipsTab rows={stats.chipUsage} /></TabsContent>
		</Tabs>
	)
}
