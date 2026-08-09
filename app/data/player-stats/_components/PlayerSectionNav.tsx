'use client'

import {
	PLAYER_STATS_SECTION_IDS,
	playerStatsSectionHash,
	type PlayerStatsSectionId
} from '@/app/data/player-stats/_lib/player-stats-url'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

const SECTION_LABEL_KEYS: Record<
	PlayerStatsSectionId,
	| 'sectionNavFixtures'
	| 'sectionNavRecent'
	| 'sectionNavMarket'
	| 'sectionNavSeason'
	| 'sectionNavProcess'
	| 'sectionNavHistory'
	| 'sectionNavCoverage'
> = {
	fixtures: 'sectionNavFixtures',
	recent: 'sectionNavRecent',
	season: 'sectionNavSeason',
	process: 'sectionNavProcess',
	history: 'sectionNavHistory',
	market: 'sectionNavMarket',
	coverage: 'sectionNavCoverage'
}

export function PlayerSectionNav({
	activeSection,
	onJump,
	sections = PLAYER_STATS_SECTION_IDS
}: {
	activeSection: PlayerStatsSectionId | null
	onJump: (section: PlayerStatsSectionId) => void
	sections?: PlayerStatsSectionId[]
}) {
	const t = useTranslations('PlayerStats')

	return (
		<nav
			aria-label={t('sectionNavLabel')}
			className="-mx-1 flex flex-wrap gap-1 px-1 pt-3"
		>
			{sections.map(section => (
				<Button
					key={section}
					type="button"
					variant={activeSection === section ? 'default' : 'outline'}
					size="sm"
					className={cn(
						'h-7 rounded-full px-3 text-xs',
						activeSection === section && 'shadow-sm'
					)}
					onClick={() => onJump(section)}
					aria-current={activeSection === section ? 'true' : undefined}
				>
					{t(SECTION_LABEL_KEYS[section])}
				</Button>
			))}
		</nav>
	)
}

export function scrollToPlayerStatsSection(section: PlayerStatsSectionId) {
	const el = document.getElementById(`ps-${section}`)
	window.history.pushState(null, '', playerStatsSectionHash(section))
	window.dispatchEvent(new PopStateEvent('popstate'))
	if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
