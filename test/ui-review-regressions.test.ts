import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const require = createRequire(import.meta.url)

describe('route contract', () => {
	it('does not preserve retired route redirects', () => {
		const config = require('../next.config.js') as { redirects?: unknown }
		assert.equal(config.redirects, undefined)
	})
})

describe('theme bootstrap', () => {
	it('uses Next Script before interactive rendering for the theme bootstrap', async () => {
		const source = await readFile(
			new URL('../app/[locale]/layout.tsx', import.meta.url),
			'utf8'
		)

		assert.ok(source.includes("from 'next/script'"))
		assert.ok(source.includes('<Script'))
		assert.ok(source.includes('id="shell-controls-bootstrap"'))
		assert.ok(source.includes('strategy="beforeInteractive"'))
		assert.doesNotMatch(source, /dangerouslySetInnerHTML|themeBootstrapScript/)
		assert.ok(source.includes('<ShellControlsReady />'))
		assert.ok(source.includes('src="/theme-bootstrap.js"'))
		assert.equal(source.includes('<script'), false)
	})

	it('keeps only the minimal theme selection render-blocking', async () => {
		const [layout, bootstrap, shellReady] = await Promise.all([
			readFile(new URL('../app/[locale]/layout.tsx', import.meta.url), 'utf8'),
			readFile(
				new URL('../public/theme-bootstrap.js', import.meta.url),
				'utf8'
			),
			readFile(
				new URL('../components/layout/ShellControlsReady.tsx', import.meta.url),
				'utf8'
			)
		])

		assert.match(
			layout,
			/id="shell-controls-bootstrap"[\s\S]*data-cfasync="false"[\s\S]*src="\/theme-bootstrap\.js"[\s\S]*strategy="beforeInteractive"/
		)
		assert.doesNotMatch(layout, /blocking="render"|fetchPriority="high"/)
		assert.ok(bootstrap.includes("localStorage.getItem('theme')"))
		assert.match(bootstrap, /data-shell-hydrated[\s\S]*shellReadyEvent/)
		assert.ok(shellReady.includes("'letletme:shell-ready'"))
	})
})

describe('live auto-sub presentation', () => {
	it('reorders the existing XI instead of rendering a separate prediction panel', async () => {
		const [dashboard, model, playerRow, squadPitch] = await Promise.all([
			readFile(
				new URL(
					'../app/live/points/_components/LivePointsDashboard.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL(
					'../app/live/points/_lib/live-points-model.ts',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL('../components/live/PlayerRow.tsx', import.meta.url),
				'utf8'
			),
			readFile(
				new URL('../components/squad-pitch/SquadPitch.tsx', import.meta.url),
				'utf8'
			)
		])

		assert.doesNotMatch(dashboard, /LiveAutoSubSummary|pitchProjected/)
		assert.match(
			model,
			/activePlayerIds[\s\S]*const isBench = !activePlayerIds\.has\(playerId\)/
		)
		for (const source of [playerRow, squadPitch]) {
			assert.doesNotMatch(source, />\s*AS\{[^}]+\}\s*</)
			assert.match(source, /\{\w+ \? '↑' : '↓'\}/)
		}
		assert.match(squadPitch, /grid-cols-\[1fr_auto\]/)
		assert.match(
			squadPitch,
			/min-w-\[clamp\(2\.5rem,4cqi,3\.5rem\)\].*text-right/
		)
	})
})

describe('dream team share image', () => {
	it('captures the pitch and its header instead of the surrounding card', async () => {
		const source = await readFile(
			new URL('../components/home/TeamOfTheWeekSection.tsx', import.meta.url),
			'utf8'
		)

		assert.match(source, /const shareRef = useRef<HTMLElement \| null>\(null\)/)
		assert.doesNotMatch(source, /<Card\b[^>]*\bref=\{shareRef\}/)
		assert.match(
			source,
			/<SquadPitch[\s\S]*ref=\{shareRef\}[\s\S]*showHeader[\s\S]*title=\{t\('teamOfWeek'\)\}/
		)
		assert.match(
			source,
			/<ShareActions[\s\S]*actions=\{\['image'\]\}[\s\S]*imageRef=\{shareRef\}/
		)
	})
})

describe('full league list sharing', () => {
	it('shares the complete view-all list from its dialog', async () => {
		const [autoCarousel, leagueCarousel] = await Promise.all([
			readFile(
				new URL('../components/home/HomeAutoCarousel.tsx', import.meta.url),
				'utf8'
			),
			readFile(
				new URL(
					'../components/home/PersonalLeagueCarousel.tsx',
					import.meta.url
				),
				'utf8'
			)
		])

		assert.match(autoCarousel, /fullContentId/)
		assert.match(autoCarousel, /data-share-fit-content="true"/)
		assert.match(autoCarousel, /data-share-full-content="true"/)
		assert.match(autoCarousel, /data-share-reserve-brand-space="true"/)
		assert.match(
			autoCarousel,
			/renderFullContentAction\(activeSlide, fullContentId\)/
		)
		assert.match(
			autoCarousel,
			/flex min-w-0 items-start justify-between gap-4 pr-12/
		)
		assert.match(
			leagueCarousel,
			/renderFullContentAction=\{\(slide, fullContentId\)/
		)
		assert.match(leagueCarousel, /imageTargetId=\{fullContentId\}/)
		assert.match(leagueCarousel, /actions=\{\['image'\]\}/)
		assert.match(
			await readFile(new URL('../app/globals.css', import.meta.url), 'utf8'),
			/\[data-share-rendering='true'\]\s+\[data-home-league-name='true'\][\s\S]*overflow: visible !important[\s\S]*text-overflow: clip !important[\s\S]*white-space: normal !important/
		)
	})
})

describe('my squad fixture pitch', () => {
	it('uses the formation pitch with color-coded fixture strips and a detail dialog', async () => {
		const [desk, pitch] = await Promise.all([
			readFile(
				new URL(
					'../app/data/fixtures/_components/MySquadFdrDesk.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL('../components/squad-pitch/SquadPitch.tsx', import.meta.url),
				'utf8'
			)
		])

		assert.match(
			desk,
			/<SquadPitch[\s\S]*onPlayerClick=\{handlePitchPlayerClick\}/
		)
		assert.match(desk, /<Dialog[\s\S]*<FullSeasonSchedule/)
		assert.match(desk, /data-schedule-pitch="true"/)
		assert.match(desk, /fixtureSchedule,/)
		assert.match(desk, /FULL_SEASON_EVENT_IDS = Array\.from\([\s\S]*length: 38/)
		assert.match(desk, /FULL_SEASON_WINDOWS = Array\.from\([\s\S]*length: 8/)
		assert.match(desk, /function CompactFixtureRow/)
		assert.match(desk, /unknown && teamFixtures\.length === 0/)
		assert.match(desk, /unknown \? \([\s\S]*fixtureUnavailable/)
		assert.match(desk, /fixture\.finished/)
		assert.match(desk, /`FDR \$\{difficulty\}`/)
		assert.match(desk, /mySquadRangeLabel/)
		assert.match(desk, /<select/)
		assert.match(desk, /data-share-preserve-width="true"/)
		assert.match(desk, /mySquadShareTitle/)
		assert.doesNotMatch(desk, /mySquadDetailDescription|mySquadDetailLegend/)
		assert.doesNotMatch(desk, /FdrLegend/)
		assert.doesNotMatch(desk, /mySquadPitchDifficulty/)
		assert.doesNotMatch(desk, /fixtureScorePending/)
		assert.match(desk, /data-retry-squad-schedule="true"/)
		assert.match(desk, /failedWindowCount/)
		assert.match(desk, /loadFullSeasonSchedule\(true\)/)
		assert.match(
			desk,
			/-mx-4 overflow-hidden rounded-xl border border-border\/60 bg-\[#210025\]/
		)
		assert.match(desk, /-mx-4 overflow-hidden rounded-xl/)
		assert.match(desk, /mx-auto w-full max-w-3xl/)
		assert.match(desk, /className="rounded-none border-0 shadow-none"/)
		assert.doesNotMatch(desk, /<SquadPitch[\s\S]*max-w-3xl/)
		assert.doesNotMatch(desk, /<table\b|overflow-x-auto/)
		assert.match(pitch, /SCHEDULE_FDR_CLASS/)
		assert.match(pitch, /fixtureSchedule\?/)
		assert.match(pitch, /share-pitch-fixture-value/)
		assert.match(pitch, /role="listitem"/)
		const styles = await readFile(
			new URL('../app/globals.css', import.meta.url),
			'utf8'
		)
		assert.match(
			styles,
			/data-share-rendering='true'\] \.share-pitch-fixture-value[\s\S]*display: inline !important/
		)
	})
})

describe('team FDR average scale', () => {
	it('shows exact averages with a continuous difficulty marker', async () => {
		const [source, detail] = await Promise.all([
			readFile(
				new URL(
					'../app/data/fixtures/_components/FdrMatrix.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL(
					'../app/data/fixtures/_components/TeamFdrDetailDialog.tsx',
					import.meta.url
				),
				'utf8'
			)
		])

		assert.match(source, /function FdrAverageCell\(/)
		assert.match(source, /const FDR_TEAM_CELL/)
		assert.match(source, /const averageFdrTier = fdrTier\(row\.avgFdr\)/)
		assert.match(source, /FDR_TEAM_CELL\[averageFdrTier\]/)
		assert.match(source, /formatAvgFdrOutOfFive\(value\)/)
		assert.match(
			source,
			/bg-gradient-to-r from-success\/80 via-warning\/80 to-destructive\/80/
		)
		assert.match(source, /style=\{\{ left: `\$\{markerPosition\}%` \}\}/)
		assert.match(source, /data-fdr-average=\{formatted\}/)
		assert.match(source, /TeamFdrDetailDialog/)
		assert.match(source, /setSelectedTeam\(row\)/)
		assert.match(source, /openTeamFixtureDetail/)
		assert.match(source, /function fixtureScore\(/)
		assert.match(
			source,
			/gameweek\?\.unknown &&[\s\S]*gameweek\.fixtures\.length === 0/
		)
		assert.match(
			detail,
			/gameweek\.unknown && gameweek\.fixtures\.length === 0/
		)
		assert.match(source, /const value = cell\.finished/)
		assert.match(source, /score \?\? t\('fixtureScorePending'\)/)
		assert.match(source, /`FDR \$\{cell\.difficulty\}`/)
		assert.match(
			source,
			/const teamName = row\.teamName\.trim\(\) \|\| row\.teamShortName/
		)
		assert.match(
			source,
			/whitespace-nowrap font-display text-xs font-bold leading-tight tracking-wide/
		)
		assert.match(
			source,
			/mt-0\.5 inline-flex rounded border border-primary\/35 bg-primary\/15 px-1 py-px font-mono text-\[0\.625rem\] font-medium/
		)
		assert.match(
			detail,
			/FULL_SEASON_EVENT_IDS = Array\.from\([\s\S]*length: 38/
		)
		assert.match(detail, /FULL_SEASON_WINDOWS = Array\.from\([\s\S]*length: 8/)
		assert.match(detail, /ref=\{shareRef\}/)
		assert.match(detail, /data-share-fit-content="true"/)
		assert.match(detail, /data-share-preserve-width="true"/)
		assert.match(detail, /actions=\{\['image'\]\}/)
		assert.match(detail, /failedWindowCount/)
		assert.match(detail, /loadFullSeasonSchedule\(true\)/)
		assert.match(detail, /<DialogDescription className="sr-only">/)
		assert.doesNotMatch(detail, /t\('teamDetailLegend'\)/)
	})
})

describe('fixture section sharing', () => {
	it('keeps team FDR sharing with its section and adds squad-pitch image sharing', async () => {
		const [page, desk] = await Promise.all([
			readFile(
				new URL('../app/data/fixtures/FixturesClient.tsx', import.meta.url),
				'utf8'
			),
			readFile(
				new URL(
					'../app/data/fixtures/_components/MySquadFdrDesk.tsx',
					import.meta.url
				),
				'utf8'
			)
		])

		assert.match(
			page,
			/<SectionHead[\s\S]*id="my-squad-heading"[\s\S]*<ShareActions[\s\S]*actions=\{\['image'\]\}/
		)
		assert.match(page, /imageRef=\{mySquadShareRef\}/)
		assert.match(page, /data-page-fdr-legend="true"/)
		assert.doesNotMatch(page, /\/\* FDR legend \*\//)
		assert.match(
			page,
			/<Card[\s\S]*aria-labelledby="fdr-teams"[\s\S]*<ShareActions[\s\S]*imageRef=\{teamFdrShareRef\}/
		)
		assert.match(
			page,
			/<Card[\s\S]*aria-labelledby="fdr-teams"[\s\S]*data-share-expand-width="true"/
		)
		assert.match(
			page,
			/<Card[\s\S]*aria-labelledby="fdr-teams"[\s\S]*<ShareActions[\s\S]*actions=\{\['image'\]\}/
		)
		assert.doesNotMatch(page, /text=\{shareText\}/)
		assert.match(desk, /<SquadPitch[\s\S]*ref=\{shareRef\}/)
		assert.match(
			page,
			/className="font-display text-lg font-bold tracking-tight sm:text-xl"/
		)
		assert.doesNotMatch(page, /t\('pageIntro'\)/)
		assert.doesNotMatch(page, /t\('actionsMySquadNote'/)
		const teamFdrHeadingIndex = page.indexOf('id="fdr-teams"')
		const sortControlIndex = page.indexOf("t('sortEasiest')")
		assert.ok(teamFdrHeadingIndex >= 0)
		assert.ok(sortControlIndex > teamFdrHeadingIndex)
	})
})

describe('explore trends presentation', () => {
	it('uses the shared page shell, tabs, and formation view without marketing copy', async () => {
		const [source, zhMessages, enMessages] = await Promise.all([
			readFile(
				new URL('../app/data/selections/TrendsClient.tsx', import.meta.url),
				'utf8'
			),
			readFile(new URL('../messages/zh-CN.json', import.meta.url), 'utf8'),
			readFile(new URL('../messages/en.json', import.meta.url), 'utf8')
		])

		assert.match(source, /StatsPageHeader/)
		assert.match(source, /StatsTabsShell/)
		assert.match(source, /TabsTrigger/)
		assert.match(source, /function TrendSquadPitch/)
		assert.match(source, /PERSONAL_EXPOSURE/)
		assert.match(source, /useLocale/)
		assert.match(source, /localePathPrefix:/)
		assert.match(source, /locale === 'en'/)
		for (const text of [source, zhMessages, enMessages]) {
			assert.doesNotMatch(text, /ROUND READ|signalDeskDescription|heroKicker/)
		}
		assert.match(source, /from ['"]@\/i18n\/navigation['"]/)
		assert.match(source, /setCohortId\(committed\.cohort\.id\)/)
		assert.match(source, /updateUrl\([\s\S]*'replace'\)/)
	})
})

describe('fixture controls copy', () => {
	it('removes the redundant range label and divider', async () => {
		const source = await readFile(
			new URL('../app/data/fixtures/FixturesClient.tsx', import.meta.url),
			'utf8'
		)

		assert.doesNotMatch(source, /horizonLabel/)
		assert.doesNotMatch(source, /t\('controlsLabel'\)|t\('controlsHint'/)
		assert.doesNotMatch(
			source,
			/className="mb-3 border-b border-border\/50 pb-2"/
		)
	})
})

describe('market freshness disclosure', () => {
	it('keeps pulse-level stale coverage visible beside pulse-backed sections', async () => {
		const source = await readFile(
			new URL('../app/data/market/MarketDashboard.tsx', import.meta.url),
			'utf8'
		)

		assert.match(source, /pulse\?\.coverage\.stale/)
		assert.match(source, /PulseFreshnessNotice/)
		assert.match(source, /PulseCoverageMeta/)
		assert.match(source, /coverage\.complete/)
		assert.match(source, /coverage\.observedDays/)
		assert.match(source, /coverage\.missingDates/)
		assert.match(source, /ownershipObservedDays/)
		assert.match(source, /movementNeedsAnotherDay/)
		assert.match(source, /nextCapture/)
		assert.match(source, /!coverage\.complete/)
		assert.match(source, /t\('pulseStaleWarning'\)/)
		assert.match(source, /role="status"/)
	})
})

describe('explore gameweek dream team presentation', () => {
	it('reuses the homepage pitch and removes the duplicate dream team list', async () => {
		const [source, surfaces] = await Promise.all([
			readFile(
				new URL(
					'../app/data/gameweek/GameweekStatsClient.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL('../components/stats/StatsSurfaces.tsx', import.meta.url),
				'utf8'
			)
		])

		assert.match(source, /import \{ TeamOfTheWeekSection \}/)
		assert.match(source, /function mapDreamTeamPlayers\(/)
		assert.match(
			source,
			/const canShareHauls[\s\S]*imageRef=\{haulShareRef\}[\s\S]*actions=\{\['image'\]\}/
		)
		assert.doesNotMatch(source, /actions=\{\['text', 'image'\]\}/)
		assert.match(
			source,
			/ref=\{haulShareRef\}[\s\S]*data-share-fit-content="true"[\s\S]*data-share-reserve-brand-space="true"/
		)
		assert.match(
			source,
			/const overviewShareRef = useRef<HTMLElement \| null>\(null\)/
		)
		assert.match(
			source,
			/data-gameweek-overview="true"[\s\S]*data-share-fit-content="true"[\s\S]*data-share-preserve-width="true"/
		)
		assert.match(
			source,
			/overviewShareTitle = t\('overview', \{ gameweek: visibleGameweek \}\)/
		)
		assert.match(
			source,
			/<ShareActions[\s\S]*actions=\{\['image'\]\}[\s\S]*imageRef=\{overviewShareRef\}/
		)
		assert.match(source, /useMatchPlayerDetail\(visibleGameweek\)/)
		assert.match(source, /onPlayerClick=\{handleHaulPlayerClick\}/)
		assert.match(
			source,
			/<TeamOfTheWeekSection[\s\S]*currentEventId=\{visibleGameweek\}[\s\S]*dreamTeam=\{dreamTeam\}[\s\S]*showShareActions/
		)
		assert.doesNotMatch(source, /<PlayerList[\s\S]*players=\{dreamTeam\}/)
		assert.match(surfaces, /action\?: ReactNode/)
	})
})

describe('gameweek update timestamp', () => {
	it('uses the published data time in the browser timezone instead of the deadline', async () => {
		const source = await readFile(
			new URL('../app/data/gameweek/GameweekStatsClient.tsx', import.meta.url),
			'utf8'
		)

		assert.match(source, /const \[updatedLabel, setUpdatedLabel\]/)
		assert.match(
			source,
			/Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/
		)
		assert.match(source, /timeZone: browserTimeZone/)
		assert.match(source, /timeStyle: 'medium'/)
		assert.match(source, /<time[\s\S]*dateTime=\{committedDesk\.publishedAt\}/)
		assert.doesNotMatch(source, /deadlineLabel/)
	})
})

describe('data freshness timestamp precision', () => {
	it('keeps seconds on market capture and snapshot/sync timestamps', async () => {
		const [
			market,
			personal,
			playerState,
			team,
			snapshotStatus,
			tournament,
			tournamentHeader
		] = await Promise.all([
			readFile(
				new URL('../components/data/MarketLocalUpdated.tsx', import.meta.url),
				'utf8'
			),
			readFile(
				new URL('../components/home/PersonalDesk.tsx', import.meta.url),
				'utf8'
			),
			readFile(
				new URL(
					'../app/data/player-stats/_components/PlayerStateSections.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL('../app/me/team/TeamStatsClient.tsx', import.meta.url),
				'utf8'
			),
			readFile(
				new URL(
					'../app/me/_components/MyFplSnapshotStatus.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL(
					'../app/me/tournament/TournamentReviewV2Client.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL(
					'../app/me/tournament/_components/TournamentStatsHeader.tsx',
					import.meta.url
				),
				'utf8'
			)
		])

		assert.match(market, /second: '2-digit'/)
		for (const source of [personal, playerState, tournamentHeader]) {
			assert.match(source, /timeStyle: 'medium'/)
		}
		assert.match(team, /<MyFplSnapshotStatus/)
		assert.match(snapshotStatus, /timeStyle: 'medium'/)
		assert.match(tournament, /settledAt/)
		assert.match(
			tournament,
			/function SettlementMeta[\s\S]*?new Date\(settledAt\)\.toLocaleString\(locale\)/
		)
	})
})

describe('homepage share images', () => {
	it('adds image actions without exporting carousel controls', async () => {
		const [carousel, market, price, deadline, leagues, marketTeaser, styles] =
			await Promise.all([
				readFile(
					new URL('../components/home/HomeAutoCarousel.tsx', import.meta.url),
					'utf8'
				),
				readFile(
					new URL('../components/home/HomeMarketCarousel.tsx', import.meta.url),
					'utf8'
				),
				readFile(
					new URL(
						'../components/home/HomePriceChangeCarousel.tsx',
						import.meta.url
					),
					'utf8'
				),
				readFile(
					new URL('../components/home/DeadlineSection.tsx', import.meta.url),
					'utf8'
				),
				readFile(
					new URL(
						'../components/home/PersonalLeagueCarousel.tsx',
						import.meta.url
					),
					'utf8'
				),
				readFile(
					new URL('../components/home/MarketTeaser.tsx', import.meta.url),
					'utf8'
				),
				readFile(new URL('../app/globals.css', import.meta.url), 'utf8')
			])

		assert.equal(carousel.match(/data-share-exclude="true"/g)?.length, 2)
		assert.match(carousel, /data-share-carousel-track="true"/)
		assert.match(carousel, /data-share-carousel-inactive=/)
		for (const source of [market, price]) {
			assert.match(source, /data-share-preserve-width="true"/)
			assert.match(source, /data-share-fit-content="true"/)
			assert.match(source, /<ShareActions[\s\S]*actions=\{\['image'\]\}/)
		}
		assert.match(market, /data-share-title="true"/)
		assert.match(market, /data-share-meta="true"/)
		assert.match(market, /LocalUpdatedLabel/)
		assert.match(market, /ownershipUpdatedAt/)
		assert.match(market, /availabilityUpdatedAt/)
		assert.match(market, /availabilityUpdatedPrefix/)
		assert.doesNotMatch(market, /availabilityDescription/)
		assert.match(price, /data-share-title="true"/)
		assert.match(price, /data-share-meta="true"/)
		assert.match(price, /LocalUpdatedLabel/)
		assert.match(price, /value=\{likely\.capturedAt\}/)
		assert.match(
			price,
			/return \(\s*<div className="space-y-6">\s*<PriceChangeDirection/
		)
		assert.match(
			price,
			/return \(\s*<div className="space-y-6">\s*<PriceChangeDirection[\s\S]*?items=\{likely\.rises\}/
		)
		assert.doesNotMatch(
			price,
			/function LikelyPage[\s\S]*?grid gap-4 sm:grid-cols-2/
		)
		assert.doesNotMatch(price, /likely\.notice/)
		assert.match(price, /capturedAt: string \| null/)
		const likelyRowStart = price.indexOf('function LikelyPlayerRow')
		const likelyPageStart = price.indexOf('function LikelyPage')
		assert.ok(likelyRowStart >= 0 && likelyPageStart > likelyRowStart)
		const likelyRow = price.slice(likelyRowStart, likelyPageStart)
		assert.match(likelyRow, /data-share-price-prediction-row="true"/)
		assert.match(likelyRow, /data-share-price-prediction-content="true"/)
		assert.match(likelyRow, /data-share-price-prediction-progress="true"/)
		assert.match(likelyRow, /data-share-price-prediction-status="true"/)
		assert.ok(
			likelyRow.indexOf('data-share-price-prediction-progress') <
				likelyRow.indexOf('data-share-price-prediction-status')
		)
		assert.doesNotMatch(likelyRow, /grid-cols-|row-start-|row-span-/)
		assert.match(
			styles,
			/data-share-price-prediction-row[\s\S]*display: flex !important[\s\S]*align-items: flex-start !important/
		)
		assert.match(marketTeaser, /ownershipUpdatedAt/)
		assert.match(marketTeaser, /lastUpdated', \{ date: '' \}/)
		assert.match(deadline, /data-share-preserve-width="true"/)
		assert.match(deadline, /data-share-deadline-actions="true"/)
		assert.match(
			styles,
			/data-share-deadline-actions[\s\S]*flex: 1 1 auto !important[\s\S]*width: auto !important[\s\S]*margin-left: auto !important[\s\S]*justify-content: flex-end !important/
		)
		assert.match(
			styles,
			/\[data-share-rendering='true'\],\s*\[data-share-rendering='true'\] \*\s*\{[\s\S]*font-family: Arial, Helvetica, sans-serif !important/
		)
		assert.match(
			styles,
			/\[data-share-rendering='true'\] h1,[\s\S]*white-space: nowrap !important/
		)
		assert.doesNotMatch(
			styles,
			/\[data-share-rendering='true'\] \[data-share-meta='true'\][\s\S]*white-space: nowrap !important/
		)
		assert.match(
			deadline,
			/buttonClassName="border-electric\/35 bg-fascia-foreground\/5 text-electric hover:border-electric hover:bg-electric\/10 hover:text-electric"/
		)
		assert.match(leagues, /data-share-preserve-width="true"/)
		assert.match(leagues, /data-share-fit-content="true"/)
		assert.match(leagues, /data-share-personal-leagues="true"/)
		assert.match(leagues, /<ShareActions[\s\S]*actions=\{\['image'\]\}/)
		assert.match(
			styles,
			/data-share-personal-leagues[\s\S]*box-sizing: border-box !important[\s\S]*padding: 1rem !important/
		)
		assert.match(
			styles,
			/data-share-full-content[\s\S]*max-height: none !important[\s\S]*overflow: visible !important/
		)
		assert.match(
			styles,
			/data-share-reserve-brand-space[\s\S]*box-sizing: border-box !important[\s\S]*padding-bottom: 3rem !important/
		)
	})
})

describe('market availability search recovery', () => {
	it('keeps a failed search page retryable without a full page reload', async () => {
		const source = await readFile(
			new URL(
				'../app/data/market/MarketAvailabilityDisclosure.tsx',
				import.meta.url
			),
			'utf8'
		)

		assert.match(source, /searchActive && unavailable && nextOffset !== null/)
		assert.match(source, /onClick=\{\(\) => void loadPage\(nextOffset\)\}/)
		assert.match(source, /availabilitySearchRetrying/)
		assert.match(source, /availabilitySearchRetry/)
	})
})

describe('countdown share layout', () => {
	it('keeps the share title readable when the card is captured from a narrow slot', async () => {
		const [source, styles] = await Promise.all([
			readFile(
				new URL('../components/home/CountdownCard.tsx', import.meta.url),
				'utf8'
			),
			readFile(new URL('../app/globals.css', import.meta.url), 'utf8')
		])

		assert.match(source, /data-countdown-header="true"/)
		assert.match(source, /data-countdown-copy="true"/)
		assert.match(source, /data-countdown-title="true"/)
		assert.match(source, /data-countdown-deadline="true"/)
		assert.match(
			styles,
			/data-countdown-header[\s\S]*display: block !important/
		)
		assert.match(
			styles,
			/data-countdown-title[\s\S]*white-space: nowrap !important/
		)
		assert.match(
			styles,
			/data-share-deadline-actions[\s\S]*position: absolute !important/
		)
	})
})

describe('share notifications', () => {
	it('uses one notification lifecycle for text and image sharing', async () => {
		const [sharedActions, matchActions, notification] = await Promise.all([
			readFile(
				new URL('../components/share/ShareActions.tsx', import.meta.url),
				'utf8'
			),
			readFile(
				new URL(
					'../components/live/match-card/MatchShareButton.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL('../components/share/share-notification.ts', import.meta.url),
				'utf8'
			)
		])

		assert.match(sharedActions, /notifyShareSuccess/)
		assert.match(sharedActions, /notifyShareWarning/)
		assert.match(sharedActions, /shareUnavailable/)
		assert.doesNotMatch(
			sharedActions,
			/from ['"]sonner['"]|toast\.(success|warning)/
		)
		assert.match(matchActions, /<ShareActions/)
		assert.match(matchActions, /compact/)
		assert.doesNotMatch(
			matchActions,
			/from ['"]sonner['"]|toast\.(success|warning)/
		)
		assert.doesNotMatch(
			matchActions,
			/shareElementImage|copyTextToClipboard|notifyShareSuccess|notifyShareWarning/
		)
		assert.match(notification, /id: SHARE_NOTIFICATION_ID/)
		assert.match(notification, /duration: 2400/)
		assert.match(
			notification,
			/toast\.success\(message, SHARE_NOTIFICATION_OPTIONS\)/
		)
		assert.match(
			notification,
			/toast\.warning\(message, SHARE_NOTIFICATION_OPTIONS\)/
		)
	})
})

describe('player detail share card', () => {
	it('shares the complete detail card without a nested scrollbar', async () => {
		const source = await readFile(
			new URL('../components/live/PlayerDetailModal.tsx', import.meta.url),
			'utf8'
		)

		assert.match(
			source,
			/const shareRef = useRef<HTMLDivElement \| null>\(null\)/
		)
		assert.match(source, /data-share-fit-content="true"/)
		assert.match(source, /data-share-preserve-width="true"/)
		assert.match(source, /typeof player\.bps === 'number'[\s\S]*label: 'BPS'/)
		assert.match(source, /player\.bonusPoints > 0[\s\S]*bonusPointsShort/)
		assert.match(source, /share-player-breakdown-label[\s\S]*whitespace-nowrap/)
		assert.match(source, /share-player-team min-w-0 truncate/)
		assert.match(
			source,
			/<ShareActions[\s\S]*imageRef=\{shareRef\}[\s\S]*actions=\{\['image'\]\}[\s\S]*compact/
		)
		assert.match(source, /max-h-\[calc\(100dvh-1rem\)\][\s\S]*overflow-y-auto/)
		assert.doesNotMatch(source, /max-h-\[min\(60vh,28rem\)\]/)
	})
})

describe('live match share card', () => {
	it('captures the complete variable-height card without controls or player list', async () => {
		const [source, playerList] = await Promise.all([
			readFile(
				new URL('../components/live/MatchCard.tsx', import.meta.url),
				'utf8'
			),
			readFile(
				new URL(
					'../components/live/match-card/MatchPlayerList.tsx',
					import.meta.url
				),
				'utf8'
			)
		])

		assert.match(source, /<Card[\s\S]*ref=\{shareRef\}/)
		assert.match(source, /data-share-preserve-width="true"/)
		assert.match(source, /data-share-fit-content="true"/)
		assert.match(source, /data-live-match-card="true"/)
		assert.match(source, /data-share-exclude="true"[\s\S]*<MatchShareButton/)
		assert.match(source, /onTextFallback=\{setManualShareText\}/)
		assert.match(
			source,
			/onTextFallbackClear=\{\(\) => setManualShareText\(null\)\}/
		)
		assert.match(
			source,
			/<div data-share-exclude="true">[\s\S]*<ShareTextFallback/
		)
		assert.match(playerList, /data-share-exclude="true"/)
		assert.doesNotMatch(source, /<div ref=\{shareRef\}/)

		const [header, highlights, styles] = await Promise.all([
			readFile(
				new URL(
					'../components/live/match-card/MatchHeader.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL(
					'../components/live/match-card/MatchHighlights.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(new URL('../app/globals.css', import.meta.url), 'utf8')
		])
		assert.match(header, /share-match-team-name/)
		assert.match(header, /share-match-team-summary/)
		assert.match(header, /share-match-score-row/)
		assert.match(highlights, /share-match-highlight-item/)
		assert.match(styles, /share-match-team-name[\s\S]*white-space: nowrap/)
		assert.match(styles, /share-match-team-name[\s\S]*font-family: Arial/)
		assert.match(styles, /share-match-highlight-item[\s\S]*white-space: nowrap/)
		assert.match(
			styles,
			/share-match-highlight-item > span[\s\S]*flex: 0 0 auto !important/
		)

		const navigation = await readFile(
			new URL(
				'../components/live/match-card/MatchNavigation.tsx',
				import.meta.url
			),
			'utf8'
		)
		const liveMatches = await readFile(
			new URL('../app/live/matches/LiveMatchesClient.tsx', import.meta.url),
			'utf8'
		)
		assert.match(navigation, /data-match-navigation="true"/)
		assert.doesNotMatch(liveMatches, /GET_LIVE_CONTEXT/)
		assert.match(liveMatches, /getLiveMatchesHead\(/)
		assert.match(liveMatches, /getLiveMatchesSnapshot\(/)
		assert.match(liveMatches, /preferHttp: true/)
		assert.match(liveMatches, /activeMatches\.length < 2/)
		assert.match(liveMatches, /event\.key === 'ArrowLeft'/)
		assert.match(liveMatches, /event\.key === 'ArrowRight'/)
		assert.match(liveMatches, /tabCountLabel\('live'\)/)
		assert.match(liveMatches, /tabCountLabel\('finished'\)/)
		assert.match(liveMatches, /tabCountLabel\('not-started'\)/)
		assert.match(liveMatches, /data-match-navigation="true"/)
		assert.match(
			liveMatches,
			/scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/
		)
	})
})

describe('live match active-event fallback', () => {
	it('corroborates fallback snapshots before seeding the client', async () => {
		const source = await readFile(
			new URL('../app/[locale]/live/matches/page.tsx', import.meta.url),
			'utf8'
		)

		assert.match(
			source,
			/live\?\.snapshot && live\.delivery\.servedFrom !== 'REDIS_CURRENT'/
		)
		assert.match(source, /loadPageContext\(\)/)
		assert.match(
			source,
			/context\.liveContext\?\.anchorEventId \?\? context\.presentation\.currentEventId/
		)
		assert.match(source, /const explicitLive = await getLiveMatchesSnapshot\(/)
	})
})

describe('price prediction share scopes', () => {
	it('keeps linked-squad text and image sharing separate from the all-player board', async () => {
		const [board, squad] = await Promise.all([
			readFile(
				new URL(
					'../app/data/price-changes/PriceChangesBoard.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL(
					'../app/data/price-changes/PriceChangeSquadPitch.tsx',
					import.meta.url
				),
				'utf8'
			)
		])

		assert.match(board, /mySquadBoardPlayers/)
		assert.match(
			board,
			/<ShareActions[\s\S]*text=\{squadShareText\}[\s\S]*imageRef=\{mySquadShareRef\}/
		)
		assert.match(
			board,
			/<PriceChangeSquadPitch[\s\S]*shareRef=\{mySquadShareRef\}/
		)
		assert.match(squad, /ref=\{shareRef\}/)
	})
})

describe('My FPL hydration', () => {
	it('renders the selected tournament label deterministically on the server', async () => {
		const source = await readFile(
			new URL(
				'../app/me/tournament/_components/TournamentStatsHeader.tsx',
				import.meta.url
			),
			'utf8'
		)

		assert.match(
			source,
			/<SelectValue placeholder=\{t\('selectTournament'\)\}>\s*\{selectedTournament\?\.name \?\? t\('selectTournament'\)\}\s*<\/SelectValue>/
		)
	})

	it('formats snapshot timestamps through the shared SSR formatter', async () => {
		const source = await readFile(
			new URL('../app/me/_components/MyFplSnapshotStatus.tsx', import.meta.url),
			'utf8'
		)

		assert.match(source, /const format = useFormatter\(\)/)
		assert.match(source, /formatDate\(/)
		assert.match(source, /format\.dateTime\(value, \{/)
		assert.doesNotMatch(source, /value\.toLocaleString\(locale/)
		assert.match(source, /meta\.finalizationDueAt\s*\?/)
		assert.match(source, /finalizingNoDue/)
		assert.match(source, /delayedNoDue/)
		assert.doesNotMatch(source, /finalizationDueAt \?\? ''/)
	})

	it('formats team snapshot timestamps through the shared SSR formatter', async () => {
		const [team, status] = await Promise.all([
			readFile(
				new URL('../app/me/team/TeamStatsClient.tsx', import.meta.url),
				'utf8'
			),
			readFile(
				new URL(
					'../app/me/_components/MyFplSnapshotStatus.tsx',
					import.meta.url
				),
				'utf8'
			)
		])

		assert.match(team, /<MyFplSnapshotStatus/)
		assert.match(status, /sourceMaxCheckedAt/)
		assert.match(status, /publishedAt/)
	})
})

describe('live tournament filter visibility', () => {
	it('keeps ownership and team-exposure filters reachable in the paged board', async () => {
		const [clientSource, filtersSource] = await Promise.all([
			readFile(
				new URL(
					'../app/live/tournaments/TournamentClient.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL(
					'../components/tournament/LiveCompetitionBoardFilters.tsx',
					import.meta.url
				),
				'utf8'
			)
		])

		assert.match(clientSource, /setShowAdvancedFilters\(open => !open\)/)
		assert.match(clientSource, /<LiveCompetitionBoardFilters/)
		assert.match(filtersSource, /t\('playerOwnership'\)/)
		assert.match(filtersSource, /t\('teamExposure'\)/)
	})

	it('keeps official H2H on its authoritative view and off the manager board', async () => {
		const source = await readFile(
			new URL('../app/live/tournaments/TournamentClient.tsx', import.meta.url),
			'utf8'
		)

		assert.ok(source.includes('isOfficialH2HTournament(selectedTournament)'))
		assert.ok(source.includes('selectedTournamentIsOfficialH2H ||'))
		assert.match(
			source,
			/selectedTournamentIsOfficialH2H \? \(\s*<OfficialH2HCompetitionView/
		)
		assert.match(
			source,
			/officialH2HReady && officialH2HReadyScopeKey === scopeKey/
		)
		assert.doesNotMatch(
			source,
			/selectedTournamentIsOfficialH2H \|\|\s*\n\s*!isLoadingInitial/
		)
		assert.doesNotMatch(source, /GET_TOURNAMENT_LIVE_DESK/)
	})

	it('waits for H2H board load before reporting deep-link readiness', async () => {
		const [clientSource, h2hSource] = await Promise.all([
			readFile(
				new URL(
					'../app/live/tournaments/TournamentClient.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL(
					'../components/tournament/OfficialH2HCompetitionView.tsx',
					import.meta.url
				),
				'utf8'
			)
		])

		assert.match(
			h2hSource,
			/hasLoaded && isUsableOfficialH2HSnapshot\(snapshot/
		)
		assert.match(clientSource, /initialSnapshot=\{null\}/)
		assert.match(clientSource, /onReadyChange=\{handleOfficialH2HReadyChange\}/)
	})

	it('clears pagination state when replacing a live board query', async () => {
		const source = await readFile(
			new URL('../app/live/tournaments/TournamentClient.tsx', import.meta.url),
			'utf8'
		)
		const replacementStart = source.indexOf('const replaceFirstPage')
		const replacementEnd = source.indexOf(
			'\n\tuseEffect(() => {',
			replacementStart
		)
		const replacementSource = source.slice(replacementStart, replacementEnd)

		assert.match(
			replacementSource,
			/\): Promise<boolean> => \{\s*\/\/ A replacement invalidates[\s\S]*setIsLoadingMore\(false\)\s*if \(rateLimitSecondsRef\.current > 0\)/
		)
	})

	it('allows keyboard gameweek navigation on official H2H boards', async () => {
		const source = await readFile(
			new URL(
				'../components/tournament/OfficialH2HCompetitionView.tsx',
				import.meta.url
			),
			'utf8'
		)

		assert.ok(source.includes("keyboardEvent.key === 'ArrowLeft'"))
		assert.ok(source.includes("keyboardEvent.key === 'ArrowRight'"))
		assert.ok(source.includes('document.activeElement'))
		assert.ok(
			source.includes(
				'router.push(`/live/competitions/${tournamentId}?gw=${targetEvent}`)'
			)
		)
		assert.ok(source.includes('enabled: showStandings'))
	})
})

describe('entry comparison layout', () => {
	it('keeps the comparison compact and aligns two complete XIs', async () => {
		const source = await readFile(
			new URL(
				'../components/tournament/EntryCompareSheet.tsx',
				import.meta.url
			),
			'utf8'
		)

		assert.ok(source.includes('function alignPickRows('))
		assert.ok(source.includes('rows.sort(compareAlignedRows)'))
		assert.doesNotMatch(source, /function alignPositionGroup\(/)
		assert.match(
			source,
			/leftPicks\.filter\(pick => pick\.positionLabel !== 'SUB'\)/
		)
		assert.match(
			source,
			/rightPicks\.filter\(pick => pick\.positionLabel !== 'SUB'\)/
		)
		assert.match(source, /gap-0 overflow-y-auto/)
		assert.match(source, /\[scrollbar-width:none\]/)
		assert.match(source, /inline-flex min-h-5 items-center/)
		assert.match(source, /min-w-\[48px\] whitespace-nowrap/)
	})
})

describe('asynchronous selection safety', () => {
	it('keeps the committed gameweek during desk loads and ignores superseded requests', async () => {
		const [gameweekSource, playerSource] = await Promise.all([
			readFile(
				new URL(
					'../app/data/gameweek/GameweekStatsClient.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL(
					'../app/data/player-stats/_hooks/usePlayerDetailSlot.ts',
					import.meta.url
				),
				'utf8'
			)
		])

		assert.ok(gameweekSource.includes('requestRef.current.controller?.abort()'))
		assert.ok(
			gameweekSource.includes('startTransition(() => setCommittedDesk(data))')
		)
		assert.ok(gameweekSource.includes('selectGameweek(committedDesk.eventId)'))
		assert.ok(
			gameweekSource.includes('requestRef.current.generation !== generation')
		)
		assert.ok(
			gameweekSource.includes('selectedGameweekRef.current !== data.eventId')
		)
		assert.ok(
			gameweekSource.includes('markRouteReadyStart(window.location.pathname)')
		)
		assert.ok(gameweekSource.includes('committedDesk.isPreseason'))
		assert.ok(gameweekSource.includes('GAMEWEEK_DESK_MAX_EVENT_ID'))
		assert.ok(gameweekSource.includes("data.overviewState === 'AVAILABLE'"))
		assert.ok(
			gameweekSource.includes('isScheduledSelection || isBoardsPending')
		)

		const staleGuard = playerSource.indexOf(
			"if (result.status === 'superseded') return null"
		)
		const notFoundClear = playerSource.indexOf(
			'setSelectedPlayer(null)',
			staleGuard
		)
		assert.ok(staleGuard >= 0 && notFoundClear > staleGuard)
		assert.ok(playerSource.includes('asOfEventId: core.asOfEventId ?? null'))
		assert.doesNotMatch(playerSource, /asOfEventId: eventId \?\? null/)
	})

	it('clears stale team and tournament models before uncached gameweek loads', async () => {
		const [teamSource, tournamentSource] = await Promise.all([
			readFile(
				new URL('../app/me/team/_hooks/useTeamStats.ts', import.meta.url),
				'utf8'
			),
			readFile(
				new URL(
					'../app/me/tournament/TournamentReviewV2Client.tsx',
					import.meta.url
				),
				'utf8'
			)
		])

		const teamLoad = teamSource.indexOf('const loadGw = async () =>')
		const teamClear = teamSource.indexOf('setTeamStats(null)', teamLoad)
		const teamRequest = teamSource.indexOf(
			'await getEntryEventResultCached',
			teamLoad
		)
		assert.ok(teamLoad >= 0 && teamClear > teamLoad && teamRequest > teamClear)

		assert.match(tournamentSource, /requestSequence = useRef\(0\)/)
		assert.match(tournamentSource, /requestId !== requestSequence\.current/)
		assert.match(tournamentSource, /GET_MY_TOURNAMENT_GAMEWEEK_REVIEW/)
		assert.doesNotMatch(tournamentSource, /GET_MY_FPL_COMPETITION/)
	})

	it('keeps finalized season context and viewer state across tournament refreshes', async () => {
		const [competitionPage, tournamentClient, teamPage] = await Promise.all([
			readFile(
				new URL(
					'../app/[locale]/my-fpl/competitions/page.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL(
					'../app/me/tournament/TournamentReviewV2Client.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL('../app/[locale]/my-fpl/team/page.tsx', import.meta.url),
				'utf8'
			)
		])

		assert.match(competitionPage, /my-tournament-review-v2\.1/)
		assert.match(competitionPage, /selectTournamentReviewEventId\(/)
		assert.match(tournamentClient, /latestFinalizedScope/)
		assert.match(tournamentClient, /GET_MY_TOURNAMENT_SEASON_REVIEW_SECTION/)
		assert.match(tournamentClient, /replaceRoute\(\{ view: nextView \}\)/)
		assert.match(tournamentClient, /semanticSha256/)
		assert.match(
			teamPage,
			/const maxKnownEvent = Math\.max\(currentEvent, latestFinalized\)/
		)
		assert.match(teamPage, /const safeRequestedEvent =/)
	})

	it('keeps the primary Season seed when an optional section read fails', async () => {
		const [page, client] = await Promise.all([
			readFile(
				new URL(
					'../app/[locale]/my-fpl/competitions/page.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL(
					'../app/me/tournament/TournamentReviewV2Client.tsx',
					import.meta.url
				),
				'utf8'
			)
		])

		assert.match(
			page,
			/const \[primaryResult, optionalResult\] = await Promise\.allSettled\(/
		)
		assert.match(
			page,
			/if \(primaryResult\.status === 'rejected'\)\s*return \{ review, sections: \[\], error: primaryResult\.reason \}/
		)
		assert.match(
			client,
			/const \[gameweekResult, seasonResult\] = await Promise\.allSettled\(/
		)
		assert.match(
			client,
			/if \(gameweekResult\.status === 'rejected'\)\s*setGameweekError\(/
		)
		assert.match(client, /if \(normalizedGameweek\) setGameweekReview\(/)
		assert.match(client, /const visibleError =\s*\n?\s*view === 'season'/)
		assert.match(
			page,
			/state: optionalSectionFailed \? 'DEGRADED' : review\.state/
		)
		assert.match(
			client,
			/setCatalog\(nextCatalog\)[\s\S]*setGameweekReview\(null\)/
		)
		assert.match(client, /const \[gameweekError, setGameweekError\]/)
	})

	it('invalidates stale picker cursors and retries incomplete personalized stats', async () => {
		const [pickerSource, selectionsSource, teamSource] = await Promise.all([
			readFile(
				new URL(
					'../components/player/PlayerDirectoryPicker.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL('../app/data/selections/SelectionsClient.tsx', import.meta.url),
				'utf8'
			),
			readFile(
				new URL('../app/me/team/_hooks/useTeamStats.ts', import.meta.url),
				'utf8'
			)
		])

		assert.match(
			pickerSource,
			/nextPlayersQueryKeyRef\.current !== playerQueryKey/
		)
		assert.match(
			selectionsSource,
			/initialStats && initialSelection\.key && !initialStatsLoadFailed/
		)
		assert.match(
			selectionsSource,
			/if \(entryResult\.status === 'rejected'\) throw entryResult\.reason/
		)
		assert.match(teamSource, /setGameweekError\(null\)/)
		assert.match(teamSource, /error: gameweekError \?\? baseError/)
		assert.match(teamSource, /peekTransferHistoryState\(entryId\)/)
		assert.match(teamSource, /setTransferRetryNonce\(value => value \+ 1\)/)
		assert.match(
			teamSource,
			/cachedReviewState === 'PENDING' \|\| cachedHistoryState === 'PENDING'/
		)
		assert.match(teamSource, /force: forceHistoryFetch/)
	})
})
