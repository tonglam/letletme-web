import { StatsSectionCard, StatsTabsShell } from '@/components/stats/StatsSurfaces'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Crown, Star, Trophy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type {
	StandingRow,
	TournamentStatsViewModel,
} from '../_lib/tournament-stats-model'
import { TournamentCaptainsTab } from './TournamentCaptainsTab'
import { TournamentChipsTab } from './TournamentChipsTab'
import { TournamentStandingsTab } from './TournamentStandingsTab'

interface TournamentStatsTabsProps {
	filteredStandings: StandingRow[]
	onSearchChange: (value: string) => void
	search: string
	stats: TournamentStatsViewModel
}

export function TournamentStatsTabs({
	filteredStandings,
	onSearchChange,
	search,
	stats,
}: TournamentStatsTabsProps) {
	const t = useTranslations('TournamentStats')
	return (
		<Tabs defaultValue="standings" className="flex flex-col gap-5">
			<StatsTabsShell>
				<TabsList className="grid h-auto w-full grid-cols-3 gap-1.5 sm:gap-2">
					<TabsTrigger value="standings" className="gap-1.5">
						<Trophy className="size-3.5 shrink-0" aria-hidden="true" />
						<span className="truncate">{t('standings')}</span>
					</TabsTrigger>
					<TabsTrigger value="captains" className="gap-1.5">
						<Crown className="size-3.5 shrink-0" aria-hidden="true" />
						<span className="truncate">{t('captains')}</span>
					</TabsTrigger>
					<TabsTrigger value="chips" className="gap-1.5">
						<Star className="size-3.5 shrink-0" aria-hidden="true" />
						<span className="truncate">{t('chips')}</span>
					</TabsTrigger>
				</TabsList>
			</StatsTabsShell>
			<TabsContent value="standings" className="mt-0">
				<StatsSectionCard title={t('standings')}>
					<TournamentStandingsTab
						rows={filteredStandings}
						search={search}
						onSearchChange={onSearchChange}
					/>
				</StatsSectionCard>
			</TabsContent>
			<TabsContent value="captains" className="mt-0">
				<TournamentCaptainsTab rows={stats.captainStats} />
			</TabsContent>
			<TabsContent value="chips" className="mt-0">
				<TournamentChipsTab rows={stats.chipUsage} />
			</TabsContent>
		</Tabs>
	)
}
