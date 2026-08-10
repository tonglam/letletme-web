import PlayerStatsClient from '@/app/data/player-stats/PlayerStatsClient'
import { parsePlayerStatsPlayerId } from '@/app/data/player-stats/_lib/player-stats-url'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { loadPlayerStatsPersonalSeed } from '@/lib/player-stats-seed'

export const dynamic = 'force-dynamic'

type PageProps = {
	params: LocaleParams
	searchParams: Promise<{ p1?: string; p2?: string }>
}

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/data/player-stats',
		titleKey: 'playerStatsTitle',
		descriptionKey: 'playerStatsDescription'
	})
}

export default async function PlayerStatsPage({
	params,
	searchParams
}: PageProps) {
	await getPageLocale(params)
	const sp = await searchParams
	const initialP1 = parsePlayerStatsPlayerId(sp.p1)
	const parsedP2 = parsePlayerStatsPlayerId(sp.p2)
	const initialP2 =
		initialP1 != null && parsedP2 != null && parsedP2 !== initialP1
			? parsedP2
			: null

	const seed = await loadPlayerStatsPersonalSeed().catch(error => {
		console.error('[player-stats] personal seed failed:', error)
		return null
	})

	// Picker and player detail remain useful when optional personal seed data is
	// unavailable (for example during preseason or a transient market outage).
	// The client will show empty squad/market context instead of blocking the
	// public Player Stats page.
	const safeSeed = seed ?? {
		anchorGw: 1,
		anchorSource: 'none' as const,
		mySquadPicks: [],
		marketCompareCandidates: [],
		seasonStatsAvailable: false
	}

	return (
		<PlayerStatsClient
			anchorGw={safeSeed.anchorGw}
			initialPlayerIds={{ p1: initialP1, p2: initialP2 }}
			mySquadPicks={safeSeed.mySquadPicks}
			marketCompareCandidates={safeSeed.marketCompareCandidates}
			seasonStatsAvailable={safeSeed.seasonStatsAvailable}
		/>
	)
}
