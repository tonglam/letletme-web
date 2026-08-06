import { StatsTabsShell } from '@/components/stats/StatsSurfaces'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowRightLeft, Calendar, Star, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { TeamStatsTab, TeamStatsViewModel } from '../_lib/team-stats-model'
import { TeamChipsTab } from './TeamChipsTab'
import { TeamHistoryTab } from './TeamHistoryTab'
import { TeamSquadTab } from './TeamSquadTab'
import { TeamTransfersTab } from './TeamTransfersTab'

interface TeamStatsTabsProps {
	activeTab: TeamStatsTab
	onTabChange: (value: string) => void
	stats: TeamStatsViewModel
}

export function TeamStatsTabs({
	activeTab,
	onTabChange,
	stats,
}: TeamStatsTabsProps) {
	const t = useTranslations('TeamStats')
	return (
		<Tabs
			value={activeTab}
			onValueChange={onTabChange}
			className="flex flex-col gap-5"
		>
			<StatsTabsShell>
				<TabsList className="grid h-auto w-full grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
					<TabsTrigger value="squad" className="gap-1.5">
						<Users className="size-3.5 shrink-0" aria-hidden="true" />
						<span className="truncate">{t('squad')}</span>
					</TabsTrigger>
					<TabsTrigger value="transfer" className="gap-1.5">
						<ArrowRightLeft className="size-3.5 shrink-0" aria-hidden="true" />
						<span className="truncate">{t('transfers')}</span>
					</TabsTrigger>
					<TabsTrigger value="chips" className="gap-1.5">
						<Star className="size-3.5 shrink-0" aria-hidden="true" />
						<span className="truncate">{t('chips')}</span>
					</TabsTrigger>
					<TabsTrigger value="history" className="gap-1.5">
						<Calendar className="size-3.5 shrink-0" aria-hidden="true" />
						<span className="truncate">{t('history')}</span>
					</TabsTrigger>
				</TabsList>
			</StatsTabsShell>

			<TabsContent value="squad" className="mt-0">
				<TeamSquadTab picks={stats.eventPicks} />
			</TabsContent>
			<TabsContent value="transfer" className="mt-0">
				<TeamTransfersTab rows={stats.transferRows} />
			</TabsContent>
			<TabsContent value="chips" className="mt-0">
				<TeamChipsTab stats={stats} />
			</TabsContent>
			<TabsContent value="history" className="mt-0">
				<TeamHistoryTab stats={stats} />
			</TabsContent>
		</Tabs>
	)
}
