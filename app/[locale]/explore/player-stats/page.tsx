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
import { withCapacityRunForRequest } from '@/lib/capacity-run'
import {
	loadPlayerStatsBootstrap,
	loadPlayerStatsPersonalSeed,
	type PlayerStatsPersonalSeed
} from '@/lib/player-stats-seed'
import { playerStatsDeskResponseFromResult } from '@/lib/player-stats-desk'
import { loadPlayerStatsDesk } from '@/lib/player-stats-desk-server'
import { RequestTiming } from '@/lib/request-timing'
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
		pathname: '/explore/player-stats',
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

async function renderPlayerStatsPage({ params, searchParams }: PageProps) {
	const { locale } = await getPageLocale(params)
	const timing = new RequestTiming()
	const bootstrapPromise = loadPlayerStatsBootstrap(timing)
	const translationPromise = timing.measure('translation', () =>
		getTranslations('PlayerStats')
	)
	const personalSeedPromise = loadPlayerStatsPersonalSeed(
		bootstrapPromise,
		undefined,
		timing
	).catch(error => {
		console.error('[player-stats] personal seed failed:', error)
		return null
	})
	const [sp, bootstrap, t] = await Promise.all([
		searchParams,
		bootstrapPromise,
		translationPromise
	])
	const initialP1 = parsePlayerStatsPlayerId(sp.p1)
	const parsedP2 = parsePlayerStatsPlayerId(sp.p2)
	const initialP2 =
		initialP1 != null && parsedP2 != null && parsedP2 !== initialP1
			? parsedP2
			: null

	const directorySeed = bootstrap.directorySeed
	const initialPlayerIds = { p1: initialP1, p2: initialP2 }
	const initialDeskSeed =
		initialP1 == null
			? null
			: await timing
					.measure('desk', () =>
						loadPlayerStatsDesk(
							[initialP1, ...(initialP2 == null ? [] : [initialP2])],
							directorySeed.anchorGw,
							5,
							'overview'
						)
					)
					.then(result =>
						result.outcome === 'failed'
							? null
							: playerStatsDeskResponseFromResult(result)
					)
					.catch(error => {
						console.error('[player-stats] initial desk failed:', error)
						return null
					})
	console.info('[player-stats-loader]', {
		locale,
		phase: 'public-ready',
		eventRevision: bootstrap.context.revision,
		durationMs: Number(timing.elapsedMs().toFixed(2)),
		stages: timing.snapshot()
	})
	void personalSeedPromise.then(() => {
		console.info('[player-stats-loader]', {
			locale,
			phase: 'stream-ready',
			eventRevision: bootstrap.context.revision,
			durationMs: Number(timing.elapsedMs().toFixed(2)),
			stages: timing.snapshot()
		})
	})

	return (
		<PageShell>
			<div className="container mx-auto max-w-6xl px-4 py-8">
				<StatsPageHeader
					title={t('title')}
					badge={
						<GameweekBadge
							gameweek={directorySeed.anchorGw}
							label={
								directorySeed.seasonStatsStatus === 'PRESEASON'
									? t('preseasonLabel')
									: undefined
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
						initialDeskSeed={initialDeskSeed}
					/>
					<Suspense fallback={null}>
						<PersonalSeedStream seedPromise={personalSeedPromise} />
					</Suspense>
				</PlayerStatsPersonalSeedProvider>
			</div>
		</PageShell>
	)
}

export default async function PlayerStatsPage(props: PageProps) {
	return withCapacityRunForRequest(() => renderPlayerStatsPage(props))
}
