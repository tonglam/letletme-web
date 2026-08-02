import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowRightLeft, Calendar, Star, Users } from 'lucide-react'
import type { TeamStatsTab, TeamStatsViewModel } from '../_lib/team-stats-model'
import { TeamChipsTab } from './TeamChipsTab'
import { TeamHistoryTab } from './TeamHistoryTab'
import { TeamSquadTab } from './TeamSquadTab'
import { TeamTransfersTab } from './TeamTransfersTab'
import { useTranslations } from 'next-intl'

interface TeamStatsTabsProps {
	activeTab: TeamStatsTab
	onTabChange: (value: string) => void
	stats: TeamStatsViewModel
}

export function TeamStatsTabs({ activeTab, onTabChange, stats }: TeamStatsTabsProps) {
	const t = useTranslations('TeamStats')
	return (
		<Tabs value={activeTab} onValueChange={onTabChange} className="flex flex-col gap-6">
			<TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
				<TabsTrigger value="squad" className="gap-2">
					<Users data-icon="inline-start" aria-hidden="true" />
					{t('squad')}
				</TabsTrigger>
				<TabsTrigger value="transfer" className="gap-2">
					<ArrowRightLeft data-icon="inline-start" aria-hidden="true" />
					{t('transfers')}
				</TabsTrigger>
				<TabsTrigger value="chips" className="gap-2">
					<Star data-icon="inline-start" aria-hidden="true" />
					{t('chips')}
				</TabsTrigger>
				<TabsTrigger value="history" className="gap-2">
					<Calendar data-icon="inline-start" aria-hidden="true" />
					{t('history')}
				</TabsTrigger>
			</TabsList>

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
