'use client'

import { Badge } from '@/components/ui/badge'
import type { EntryTournament } from '@/lib/graphql/operations/tournaments'
import { getTournamentLifecycleBadge } from '@/lib/tournament/lifecycle'
import { useTranslations } from 'next-intl'

export function TournamentLifecycleBadge({
	tournament,
}: {
	tournament: Pick<
		EntryTournament,
		'state' | 'rosterSyncStatus' | 'setupStatus' | 'standingsReadyAt' | 'setupHasWarnings'
	>
}) {
	const t = useTranslations('TournamentLifecycle')
	const state = getTournamentLifecycleBadge(tournament)
	const variant = state === 'needsAttention'
		? 'destructive'
		: state === 'ready' || state === 'finished'
			? 'default'
			: 'secondary'

	return <Badge variant={variant}>{t(state)}</Badge>
}
