import { PageState } from '@/components/feedback/PageState'
import PageShell from '@/components/layout/PageShell'
import { CalendarX2 } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

type StatesKey =
	| 'gameweekUnavailableTitle'
	| 'gameweekUnavailableDescription'
	| 'liveTournamentUnavailableTitle'
	| 'selectionUnavailableTitle'
	| 'fixturesUnavailableTitle'
	| 'teamStatsUnavailableTitle'
	| 'tournamentStatsUnavailableTitle'
	| 'tournamentStatsUnavailableDescription'

/**
 * Shared empty state when live calc / this-GW seed cannot run because
 * `events(isCurrent: true)` is empty. Prefer this over ad-hoc PageState copies.
 */
export async function CurrentGameweekUnavailable({
	titleKey = 'gameweekUnavailableTitle',
	descriptionKey = 'gameweekUnavailableDescription',
}: {
	titleKey?: StatesKey
	descriptionKey?: StatesKey
} = {}) {
	const t = await getTranslations('States')
	return (
		<PageShell>
			<PageState
				icon={CalendarX2}
				title={t(titleKey)}
				description={t(descriptionKey)}
			/>
		</PageShell>
	)
}
