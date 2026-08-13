import PlayerStatsClient from '@/app/data/player-stats/PlayerStatsClient'
import {
	PlayerStatsPersonalSeedCommit,
	PlayerStatsPersonalSeedProvider
} from '@/app/data/player-stats/PlayerStatsPersonalSeedContext'
import { parsePlayerStatsPlayerId } from '@/app/data/player-stats/_lib/player-stats-url'
import PageShell from '@/components/layout/PageShell'
import { GameweekBadge } from '@/components/stats/GameweekBadge'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import {
	loadPlayerDirectorySeed,
	loadPlayerStatsPersonalSeed,
	type PlayerStatsPersonalSeed
} from '@/lib/player-stats-seed'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

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

async function PersonalSeedStream({
	seedPromise
}: {
	seedPromise: Promise<PlayerStatsPersonalSeed | null>
}) {
	return <PlayerStatsPersonalSeedCommit seed={await seedPromise} />
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

	const personalSeedPromise = loadPlayerStatsPersonalSeed().catch(error => {
		console.error('[player-stats] personal seed failed:', error)
		return null
	})
	const [directorySeed, t] = await Promise.all([
		loadPlayerDirectorySeed(),
		getTranslations('PlayerStats')
	])
	const initialPlayerIds = { p1: initialP1, p2: initialP2 }

	return (
		<PageShell>
			<div className="container mx-auto max-w-6xl px-4 py-8">
				<StatsPageHeader
					title={t('title')}
					badge={
						<GameweekBadge
							gameweek={directorySeed.anchorGw}
							label={
								directorySeed.seasonStatsAvailable
									? undefined
									: t('preseasonLabel')
							}
						/>
					}
				/>
				<p className="-mt-4 mb-6 max-w-2xl text-sm leading-6 text-muted-foreground">
					{t('pageIntro')}
				</p>

				<PlayerStatsPersonalSeedProvider>
					<PlayerStatsClient
						directorySeed={directorySeed}
						initialPlayerIds={initialPlayerIds}
					/>
					<Suspense fallback={null}>
						<PersonalSeedStream seedPromise={personalSeedPromise} />
					</Suspense>
				</PlayerStatsPersonalSeedProvider>
			</div>
		</PageShell>
	)
}
