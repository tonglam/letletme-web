import { StatsSectionCard } from '@/components/stats/StatsSurfaces'
import {
	ArrowRightLeft,
	CalendarDays,
	History,
	Shirt,
	Star,
	UserRound,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { MyFplSelectionRules } from '@/lib/graphql/operations/my-fpl'
import type { TeamSeasonLogs } from '../_lib/team-stats-model'
import { TeamBenchTab } from './TeamBenchTab'
import { TeamCaptainsTab } from './TeamCaptainsTab'
import { TeamChipsTab } from './TeamChipsTab'
import {
	TeamGameweekHistory,
	TeamSeasonHistory,
} from './TeamHistoryTab'
import { TeamTransfersTab } from './TeamTransfersTab'

/**
 * Season detail sections in the order used by the My FPL team view.
 *
 * The legacy charts remain useful presentation surfaces, while manager-only
 * decision analysis is rendered from the strict review contract above them.
 */
export function TeamStatsDeepDive({
	logs,
	currentSeason,
	transfersLoading = false,
	rules,
}: {
	logs: TeamSeasonLogs
	currentSeason: string | null
	/** Move-level transfer details load after paint (counts already on rows). */
	transfersLoading?: boolean
	rules: MyFplSelectionRules | null
}) {
	const t = useTranslations('TeamStats')

	return (
		<div className="space-y-4 sm:space-y-5">
			<StatsSectionCard
				icon={UserRound}
				title={t('captainHistory')}
				description={t('captainHistoryHint')}
			>
				<TeamCaptainsTab logs={logs} />
			</StatsSectionCard>

			<StatsSectionCard
				icon={Shirt}
				title={t('benchHistory')}
				description={t('benchHistoryHint')}
			>
				<TeamBenchTab logs={logs} />
			</StatsSectionCard>

			<StatsSectionCard icon={ArrowRightLeft} title={t('transferHistory')}>
				<div aria-busy={transfersLoading}>
					{transfersLoading ? (
						<p className="mb-2 text-xs text-muted-foreground">
							{t('transferDetailsLoading')}
						</p>
					) : null}
					<TeamTransfersTab rows={logs.transferRows} />
				</div>
			</StatsSectionCard>

			<StatsSectionCard icon={Star} title={t('chipUsage')}>
				<TeamChipsTab stats={logs} rules={rules} />
			</StatsSectionCard>

			<StatsSectionCard
				icon={CalendarDays}
				title={t('gameweekHistory')}
				description={t('gameweekHistoryHint')}
			>
				<TeamGameweekHistory stats={logs} />
			</StatsSectionCard>

			<StatsSectionCard
				icon={History}
				title={t('seasonHistory')}
				description={t('seasonHistoryHint')}
			>
				<TeamSeasonHistory
					stats={logs}
					currentSeason={currentSeason}
				/>
			</StatsSectionCard>
		</div>
	)
}
