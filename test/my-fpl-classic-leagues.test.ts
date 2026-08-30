import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import {
	selectUntrackedFplClassicLeagueRanks,
	type EntryLeague
} from '../lib/graphql/operations/leagues'

const league = (partial: Partial<EntryLeague>): EntryLeague => ({
	id: 1,
	name: 'Classic league',
	type: 'CLASSIC',
	officialKind: 'INVITATIONAL',
	shortName: null,
	entryRank: 12,
	entryLastRank: 15,
	totalTeamNum: null,
	startedEvent: 1,
	tournamentId: null,
	tournamentName: null,
	state: null,
	...partial
})

describe('My FPL Classic league visibility', () => {
	it('keeps untracked Classic ranks and excludes leagues already shown as competitions', () => {
		assert.deepEqual(
			selectUntrackedFplClassicLeagueRanks([
				league({ id: 11, name: 'Invitational Classic' }),
				league({ id: 12, name: 'Tracked Classic', tournamentId: 3 }),
				league({ id: 13, name: 'Head to Head', type: 'H2H' }),
				league({
					id: 14,
					name: 'Overall',
					officialKind: 'SYSTEM',
					entryRank: 1234,
					entryLastRank: null
				})
			]),
			[
				{
					leagueId: 11,
					name: 'Invitational Classic',
					rank: 12,
					previousRank: 15,
					officialKind: 'INVITATIONAL'
				},
				{
					leagueId: 14,
					name: 'Overall',
					rank: 1234,
					previousRank: null,
					officialKind: 'SYSTEM'
				}
			]
		)
	})

	it('seeds the settled tournament review through the V2 server contract', async () => {
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

		assert.match(page, /GET_MY_TOURNAMENT_REVIEW_CATALOG/)
		assert.match(page, /GET_MY_TOURNAMENT_GAMEWEEK_REVIEW/)
		assert.match(page, /GET_MY_TOURNAMENT_SEASON_REVIEW/)
		assert.match(page, /latestSettledEventId/)
		assert.match(page, /selectTournamentReviewEventId/)
		assert.match(page, /initialCatalog=\{initialCatalog\}/)
		assert.match(page, /initialFinalizedEventIds=\{initialFinalizedEventIds\}/)
		assert.match(page, /initialGameweekReview=\{initialGameweekReview\}/)
		assert.match(client, /GET_MY_TOURNAMENT_REVIEW_CATALOG/)
		assert.match(client, /GET_MY_TOURNAMENT_GAMEWEEK_REVIEW/)
		assert.match(client, /GET_MY_TOURNAMENT_SEASON_REVIEW/)
		assert.match(client, /CONTRACT = 'my-tournament-review-v2'/)
		assert.match(client, /if \(loading \|\| loadingMore/)
		assert.match(client, /revision: requestRevision/)
		assert.match(
			client,
			/setGameweekReview\(null\)[\s\S]*setSeasonReview\(null\)/
		)
		assert.match(client, /\+\+requestSequence\.current/)
		assert.match(client, /replaceRoute\(\{ eventId: nextEventId \}\)/)
	})
})
