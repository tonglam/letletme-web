import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Crown, Star, Trophy } from 'lucide-react'
import type { StandingRow, TournamentStatsViewModel } from '../_lib/tournament-stats-model'
import { TournamentCaptainsTab } from './TournamentCaptainsTab'
import { TournamentChipsTab } from './TournamentChipsTab'
import { TournamentStandingsTab } from './TournamentStandingsTab'
import { useTranslations } from 'next-intl'

interface TournamentStatsTabsProps {
	filteredStandings: StandingRow[]
	onSearchChange: (value: string) => void
	search: string
	stats: TournamentStatsViewModel
}

export function TournamentStatsTabs({ filteredStandings, onSearchChange, search, stats }: TournamentStatsTabsProps) {
	const t = useTranslations('TournamentStats')
	return (
		<Tabs defaultValue="standings" className="flex flex-col gap-6">
			<TabsList className="grid h-auto w-full grid-cols-3">
				<TabsTrigger value="standings" className="gap-2">
					<Trophy data-icon="inline-start" aria-hidden="true" /> {t('standings')}
				</TabsTrigger>
				<TabsTrigger value="captains" className="gap-2">
					<Crown data-icon="inline-start" aria-hidden="true" /> {t('captains')}
				</TabsTrigger>
				<TabsTrigger value="chips" className="gap-2">
					<Star data-icon="inline-start" aria-hidden="true" /> {t('chips')}
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
