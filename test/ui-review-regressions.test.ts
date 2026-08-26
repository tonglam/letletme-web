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
		assert.ok(source.includes('id="theme-bootstrap"'))
		assert.ok(source.includes('strategy="beforeInteractive"'))
		assert.ok(source.includes('dangerouslySetInnerHTML'))
		assert.ok(source.includes("localStorage.getItem('theme')"))
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

		assert.ok(layout.includes('id="theme-bootstrap"'))
		assert.match(
			layout,
			/id="theme-bootstrap"[\s\S]*dangerouslySetInnerHTML=\{\{ __html: themeBootstrapScript \}\}/
		)
		assert.match(
			layout,
			/id="shell-controls-bootstrap"[\s\S]*data-cfasync="false"[\s\S]*src="\/theme-bootstrap\.js"[\s\S]*strategy="beforeInteractive"/
		)
		assert.doesNotMatch(layout, /blocking="render"|fetchPriority="high"/)
		assert.match(layout, /const themeBootstrapScript = `[\s\S]*localStorage/)
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
		assert.match(source, /const haulShareText[\s\S]*actions=\{\['text'\]\}/)
		assert.match(
			source,
			/<TeamOfTheWeekSection[\s\S]*currentEventId=\{visibleGameweek\}[\s\S]*dreamTeam=\{dreamTeam\}[\s\S]*showShareActions=\{false\}/
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
		const [market, personal, playerState, team, tournament, tournamentHeader] =
			await Promise.all([
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
						'../app/me/tournament/TournamentStatsClient.tsx',
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
		for (const source of [
			personal,
			playerState,
			team,
			tournament,
			tournamentHeader
		]) {
			assert.match(source, /timeStyle: 'medium'/)
		}
	})
})

describe('homepage share images', () => {
	it('adds image actions without exporting carousel controls', async () => {
		const [carousel, market, price, deadline, leagues, marketTeaser] =
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
				)
			])

		assert.equal(carousel.match(/data-share-exclude="true"/g)?.length, 2)
		assert.match(carousel, /data-share-carousel-track="true"/)
		assert.match(carousel, /data-share-carousel-inactive=/)
		for (const source of [market, price]) {
			assert.match(source, /data-share-preserve-width="true"/)
			assert.match(source, /data-share-fit-content="true"/)
			assert.match(source, /<ShareActions[\s\S]*actions=\{\['image'\]\}/)
		}
		assert.match(market, /LocalUpdatedLabel/)
		assert.match(market, /ownershipUpdatedAt/)
		assert.match(price, /LocalUpdatedLabel/)
		assert.match(price, /value=\{likely\.capturedAt\}/)
		assert.doesNotMatch(price, /likely\.notice/)
		assert.match(price, /capturedAt: string \| null/)
		assert.match(marketTeaser, /ownershipUpdatedAt/)
		assert.match(marketTeaser, /lastUpdated', \{ date: '' \}/)
		assert.match(deadline, /data-share-preserve-width="true"/)
		assert.match(deadline, /data-share-deadline-actions="true"/)
		assert.match(
			await readFile(
				new URL('../app/globals.css', import.meta.url),
				'utf8'
			),
			/data-share-deadline-actions[\s\S]*flex: 1 1 auto !important[\s\S]*width: auto !important[\s\S]*margin-left: auto !important[\s\S]*justify-content: flex-end !important/
		)
		assert.match(
			deadline,
			/buttonClassName="text-primary-ink hover:text-primary-ink"/
		)
		assert.match(leagues, /data-share-preserve-width="true"/)
		assert.match(leagues, /data-share-fit-content="true"/)
		assert.match(leagues, /<ShareActions[\s\S]*actions=\{\['image'\]\}/)
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

		for (const source of [sharedActions, matchActions]) {
			assert.match(source, /notifyShareSuccess/)
			assert.match(source, /notifyShareWarning/)
			assert.doesNotMatch(
				source,
				/from ['"]sonner['"]|toast\.(success|warning)/
			)
		}
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
		assert.match(source, /share-player-breakdown-label[\s\S]*whitespace-nowrap/)
		assert.match(source, /share-player-team min-w-0 truncate/)
		assert.match(
			source,
			/<ShareActions[\s\S]*imageRef=\{shareRef\}[\s\S]*actions=\{\['image'\]\}/
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
		assert.match(liveMatches, /activeMatches\.length < 2/)
		assert.match(liveMatches, /event\.key === 'ArrowLeft'/)
		assert.match(liveMatches, /event\.key === 'ArrowRight'/)
		assert.match(liveMatches, /data-match-navigation="true"/)
		assert.match(
			liveMatches,
			/scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/
		)
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
			new URL(
				'../app/me/tournament/TournamentStatsClient.tsx',
				import.meta.url
			),
			'utf8'
		)

		assert.match(source, /const format = useFormatter\(\)/)
		assert.match(source, /formatSnapshotDate\(snapshotMeta, format\)/)
		assert.match(source, /format\.dateTime\(value, \{/)
		assert.doesNotMatch(source, /value\.toLocaleString\(locale/)
	})

	it('formats team snapshot timestamps through the shared SSR formatter', async () => {
		const source = await readFile(
			new URL('../app/me/team/TeamStatsClient.tsx', import.meta.url),
			'utf8'
		)

		assert.match(source, /const format = useFormatter\(\)/)
		assert.match(source, /formatSnapshotDate\(snapshotMeta, format\)/)
		assert.match(source, /format\.dateTime\(value, \{/)
		assert.doesNotMatch(source, /value\.toLocaleString\(locale/)
	})
})

describe('live tournament filter visibility', () => {
	it('keeps both advanced filters recoverable after dismissal', async () => {
		const [clientSource, ownershipSource, exposureSource] = await Promise.all([
			readFile(
				new URL(
					'../app/live/tournaments/TournamentClient.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL(
					'../components/player/PlayerOwnershipFilter.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL('../components/player/TeamExposureFilter.tsx', import.meta.url),
				'utf8'
			)
		])

		assert.match(clientSource, /setShowOwnershipFilter\(true\)/)
		assert.match(clientSource, /setShowTeamExposureFilter\(true\)/)
		assert.match(clientSource, /filtersT\('showFilter'/)
		assert.match(ownershipSource, /t\("hideFilter"/)
		assert.match(exposureSource, /t\('hideFilter'/)
	})

	it('uses the event-aware live desk for official H2H board fallback', async () => {
		const source = await readFile(
			new URL('../app/live/tournaments/TournamentClient.tsx', import.meta.url),
			'utf8'
		)

		assert.ok(source.includes('GET_TOURNAMENT_LIVE_DESK'))
		assert.ok(source.includes("detailDesk?.kind !== 'OFFICIAL_H2H'"))
		assert.ok(
			source.includes(
				'{ entryId, selectedTournamentId: tournamentId, ref: null }'
			)
		)
		assert.ok(
			source.includes('response.entryLiveCompetitionsDesk.eventId !== eventId')
		)
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
	})

	it('clears stale team and tournament models before uncached gameweek loads', async () => {
		const [teamSource, tournamentSource] = await Promise.all([
			readFile(
				new URL('../app/me/team/_hooks/useTeamStats.ts', import.meta.url),
				'utf8'
			),
			readFile(
				new URL(
					'../app/me/tournament/_hooks/useTournamentStats.ts',
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

		const tournamentLoad = tournamentSource.indexOf(
			'// One request owns the selected tournament + GW'
		)
		const tournamentClear = tournamentSource.indexOf(
			'setTournamentStats(null)',
			tournamentLoad
		)
		const tournamentRequest = tournamentSource.indexOf(
			'loadGameweekData && selectedGameweek > 0 ? selectedGameweek : null',
			tournamentLoad
		)
		assert.ok(
			tournamentLoad >= 0 &&
				tournamentClear > tournamentLoad &&
				tournamentRequest > tournamentClear
		)
	})

	it('keeps finalized season context and viewer state across tournament refreshes', async () => {
		const [
			competitionPage,
			tournamentClient,
			tournamentHook,
			adapters,
			teamPage
		] = await Promise.all([
			readFile(
				new URL(
					'../app/[locale]/my-fpl/competitions/page.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL(
					'../app/me/tournament/TournamentStatsClient.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL(
					'../app/me/tournament/_hooks/useTournamentStats.ts',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL(
					'../app/me/tournament/_lib/my-fpl-adapters.ts',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL('../app/[locale]/my-fpl/team/page.tsx', import.meta.url),
				'utf8'
			)
		])

		assert.match(
			competitionPage,
			/initialView === 'season' \? null : requestedEventId/
		)
		assert.match(tournamentClient, /const handleNavigateSeason = useCallback/)
		assert.match(
			tournamentClient,
			/replaceQuery\(\{ view: 'season', gw: null \}\)/
		)
		assert.match(tournamentHook, /setDeskRefreshNonce\(value => value \+ 1\)/)
		assert.match(tournamentHook, /boardAbortRef\.current\?\.abort\(\)/)
		assert.match(tournamentHook, /setIsBoardLoading\(false\)/)
		assert.match(
			tournamentHook,
			/commitBoardPage\(boardWithViewer, standingsSearch\.trim\(\)\)/
		)
		assert.match(tournamentHook, /initialReviewState === 'READY'/)
		assert.match(tournamentHook, /initialBoard !== null/)
		const searchFailure = tournamentHook.indexOf('board search failed:')
		assert.ok(searchFailure >= 0)
		assert.equal(
			tournamentHook.indexOf('setTournamentStats(null)', searchFailure),
			-1
		)
		assert.match(tournamentHook, /setSeasonPath\(\[\]\)/)
		assert.match(tournamentHook, /initialBoardSearchSkippedRef\.current/)
		assert.match(tournamentHook, /latestFinalizedGameweek \?\? dataGameweek/)
		assert.match(tournamentClient, /setStandingsSearch\(''\)/)
		assert.match(tournamentClient, /boardSearch === ''/)
		assert.match(adapters, /myRank: viewerRow\?\.rank \?\? aggregate\.viewer/)
		assert.match(adapters, /rank: row\.fieldRank/)
		assert.match(tournamentHook, /setError\(t\('loadFailed'\)\)/)
		assert.match(
			teamPage,
			/const maxKnownEvent = Math\.max\(currentEvent, latestFinalized\)/
		)
		assert.match(teamPage, /const safeRequestedEvent =/)
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
			/cachedDeskState === 'PENDING' \|\| cachedState === 'PENDING'/
		)
		assert.match(teamSource, /force: forceHistoryFetch/)
	})
})
