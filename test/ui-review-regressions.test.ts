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
	it('inlines the theme bootstrap script in the locale layout head', async () => {
		const source = await readFile(
			new URL('../app/[locale]/layout.tsx', import.meta.url),
			'utf8'
		)

		assert.ok(source.includes('id="theme-bootstrap"'))
		assert.ok(source.includes('dangerouslySetInnerHTML'))
		assert.ok(source.includes("localStorage.getItem('theme')"))
		assert.equal(source.includes('strategy="afterInteractive"'), false)
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
		assert.match(tournamentHook, /initialReviewState !== 'PENDING'/)
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
