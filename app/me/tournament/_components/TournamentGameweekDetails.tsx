'use client'

import { StatsSectionCard } from '@/components/stats/StatsSurfaces'
import { useTranslations } from 'next-intl'
import type {
	StandingRow,
	TournamentStatsViewModel,
} from '../_lib/tournament-stats-model'
import { TournamentCaptainsTab } from './TournamentCaptainsTab'
import { TournamentChipsTab } from './TournamentChipsTab'
import { TournamentStandingsTab } from './TournamentStandingsTab'

/**
 * GW detail stack (no tabs):
 * 1) Field intel — most captained + chips (side by side)
 * 2) Full standings table (searchable)
 *
 * Standings is a table of every team; captains/chips are field-wide
 * popularity stats — different jobs, so not shared tabs.
 */
export function TournamentGameweekDetails({
	filteredStandings,
	onSearchChange,
	search,
	stats,
}: {
	filteredStandings: StandingRow[]
	onSearchChange: (value: string) => void
	search: string
	stats: TournamentStatsViewModel
}) {
	const t = useTranslations('TournamentStats')

	return (
		<div className="space-y-5 sm:space-y-6">
			{/* Field intel: who was captained / which chips fired */}
			<section aria-label={t('fieldIntel')}>
				<p className="mb-3 font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
					{t('fieldIntel')}
				</p>
				<div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-5">
					<TournamentCaptainsTab rows={stats.captainStats} />
					<TournamentChipsTab rows={stats.chipUsage} />
				</div>
			</section>

			{/* Full table — league position this GW */}
			<StatsSectionCard
				title={t('standings')}
				description={t('standingsHint')}
			>
				<TournamentStandingsTab
					rows={filteredStandings}
					search={search}
					onSearchChange={onSearchChange}
				/>
			</StatsSectionCard>
		</div>
	)
}
