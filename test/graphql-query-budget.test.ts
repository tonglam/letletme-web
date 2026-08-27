import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { parse, visit } from 'graphql'
import {
	GET_EVENT_LIVE_EXPLAINS,
	GET_LIVE_MATCHDAY_DESK
} from '../lib/graphql/operations/live'
import {
	GET_FIXTURE_PLANNING_OWNERSHIP_GAMEWEEK,
	GET_FIXTURE_PLANNING_SIGNALS,
	GET_MARKET_PULSE
} from '../lib/graphql/operations/market'
import {
	GET_PRICE_CHANGE_BOARD,
	GET_PRICE_CHANGE_LIVE_BOARD,
	GET_PRICE_CHANGE_LIVE_CURSOR
} from '../lib/graphql/operations/price-changes'
import {
	GET_PLAYER_STATS_DESK_OVERVIEW,
	PLAYER_STATS_DESK_MAX_AST_NODES,
	GET_PLAYER_STATE_PROFILE,
	SEARCH_PLAYERS_FOR_PICKER
} from '../lib/graphql/operations/players'
import {
	GET_HOME_GAMEWEEK,
	GET_HOME_MARKET_OWNERSHIP,
	GET_HOME_MARKET_PULSE,
	GET_HOME_PERSONAL_DESK,
	GET_HOME_PUBLIC_BOOTSTRAP
} from '../lib/graphql/operations/home'
import {
	GET_ENTRY_OFFICIAL_H2H_DESK,
	GET_ENTRY_OFFICIAL_H2H_MATCHUPS,
	GET_TOURNAMENT_DETAIL_DESK,
	GET_TOURNAMENT_METADATA,
	GET_TOURNAMENT_OFFICIAL_H2H,
	GET_TOURNAMENT_PARTICIPANTS,
	GET_TOURNAMENT_LIVE_DESK
} from '../lib/graphql/operations/tournaments'
import { GET_MY_FPL_COMPETITIONS_DESK } from '../lib/graphql/operations/my-fpl'

describe('GraphQL request budget', () => {
	it('uses one root field for the fifteen-player live explanation batch', () => {
		const document = parse(GET_EVENT_LIVE_EXPLAINS)
		let astNodes = 0
		visit(document, { enter: () => void (astNodes += 1) })
		const operation = document.definitions.find(
			definition => definition.kind === 'OperationDefinition'
		)
		assert.ok(operation?.kind === 'OperationDefinition')
		assert.equal(operation.selectionSet.selections.length, 1)
		assert.ok(
			astNodes < 200,
			`GET_EVENT_LIVE_EXPLAINS has ${astNodes} AST nodes`
		)
	})

	it('keeps GET_LIVE_MATCHDAY_DESK below the production 200-node guard', () => {
		const document = parse(GET_LIVE_MATCHDAY_DESK)
		let astNodes = 0
		visit(document, { enter: () => void (astNodes += 1) })

		assert.ok(
			astNodes < 200,
			`GET_LIVE_MATCHDAY_DESK has ${astNodes} AST nodes`
		)
	})

	it('keeps GET_MARKET_PULSE below the production 200-node guard', () => {
		const document = parse(GET_MARKET_PULSE)
		let astNodes = 0
		visit(document, { enter: () => void (astNodes += 1) })

		assert.ok(astNodes < 200, `GET_MARKET_PULSE has ${astNodes} AST nodes`)
	})

	it('keeps the official price-change board as one bounded public root', () => {
		const document = parse(GET_PRICE_CHANGE_BOARD)
		const operation = document.definitions.find(
			definition => definition.kind === 'OperationDefinition'
		)
		assert.ok(operation?.kind === 'OperationDefinition')
		assert.equal(operation.selectionSet.selections.length, 1)
	})

	it('keeps the live cursor and live board as bounded additive roots', () => {
		for (const [name, query] of [
			['GET_PRICE_CHANGE_LIVE_CURSOR', GET_PRICE_CHANGE_LIVE_CURSOR],
			['GET_PRICE_CHANGE_LIVE_BOARD', GET_PRICE_CHANGE_LIVE_BOARD]
		] as const) {
			const document = parse(query)
			let astNodes = 0
			visit(document, { enter: () => void (astNodes += 1) })
			const operation = document.definitions.find(
				definition => definition.kind === 'OperationDefinition'
			)
			assert.ok(operation?.kind === 'OperationDefinition')
			assert.equal(operation.selectionSet.selections.length, 1)
			assert.ok(astNodes < 200, `${name} has ${astNodes} AST nodes`)
		}
	})

	it('keeps each Home document within the production query budget', () => {
		for (const [name, query, expectedRoots] of [
			['GET_HOME_PUBLIC_BOOTSTRAP', GET_HOME_PUBLIC_BOOTSTRAP, 1],
			['GET_HOME_PERSONAL_DESK', GET_HOME_PERSONAL_DESK, 1],
			['GET_HOME_MARKET_PULSE', GET_HOME_MARKET_PULSE, 1],
			['GET_HOME_MARKET_OWNERSHIP', GET_HOME_MARKET_OWNERSHIP, 1],
			['GET_HOME_GAMEWEEK', GET_HOME_GAMEWEEK, 1]
		] as const) {
			const document = parse(query)
			let astNodes = 0
			visit(document, { enter: () => void (astNodes += 1) })
			const operation = document.definitions.find(
				definition => definition.kind === 'OperationDefinition'
			)
			assert.ok(operation?.kind === 'OperationDefinition')
			assert.equal(operation.selectionSet.selections.length, expectedRoots)
			assert.ok(astNodes < 200, `${name} has ${astNodes} AST nodes`)
		}
	})

	it('keeps fixture market signals and ownership periods isolated', () => {
		for (const [name, query] of [
			['GET_FIXTURE_PLANNING_SIGNALS', GET_FIXTURE_PLANNING_SIGNALS],
			[
				'GET_FIXTURE_PLANNING_OWNERSHIP_GAMEWEEK',
				GET_FIXTURE_PLANNING_OWNERSHIP_GAMEWEEK
			]
		] as const) {
			const document = parse(query)
			let astNodes = 0
			visit(document, { enter: () => void (astNodes += 1) })
			const operation = document.definitions.find(
				definition => definition.kind === 'OperationDefinition'
			)
			assert.ok(operation?.kind === 'OperationDefinition')
			assert.equal(operation.selectionSet.selections.length, 1)
			assert.ok(astNodes < 200, `${name} has ${astNodes} AST nodes`)
		}
		for (const unusedField of [
			'availabilityUpdates',
			'newPlayers',
			'priceChanges'
		]) {
			assert.doesNotMatch(
				GET_FIXTURE_PLANNING_SIGNALS,
				new RegExp(`\\b${unusedField}\\b`)
			)
		}
		assert.match(GET_FIXTURE_PLANNING_OWNERSHIP_GAMEWEEK, /period:\s*GAMEWEEK/)
	})

	it('keeps the player-state profile bounded to one root field', () => {
		const document = parse(GET_PLAYER_STATE_PROFILE)
		let astNodes = 0
		visit(document, { enter: () => void (astNodes += 1) })
		const operation = document.definitions.find(
			definition => definition.kind === 'OperationDefinition'
		)
		assert.ok(operation?.kind === 'OperationDefinition')
		assert.equal(operation.selectionSet.selections.length, 1)
		assert.ok(
			astNodes <= 240,
			`GET_PLAYER_STATE_PROFILE has ${astNodes} AST nodes`
		)
	})

	it('keeps the Player Stats desk overview within its bounded production guard', () => {
		const document = parse(GET_PLAYER_STATS_DESK_OVERVIEW)
		let astNodes = 0
		visit(document, { enter: () => void (astNodes += 1) })
		assert.equal(astNodes, 254)
		assert.ok(
			astNodes <= PLAYER_STATS_DESK_MAX_AST_NODES,
			`GET_PLAYER_STATS_DESK_OVERVIEW has ${astNodes} AST nodes`
		)
	})

	it('keeps the My FPL competitions desk within its bounded 400-node guard', () => {
		const document = parse(GET_MY_FPL_COMPETITIONS_DESK)
		let astNodes = 0
		visit(document, { enter: () => void (astNodes += 1) })
		const operation = document.definitions.find(
			definition => definition.kind === 'OperationDefinition'
		)
		assert.ok(operation?.kind === 'OperationDefinition')
		assert.equal(operation.selectionSet.selections.length, 1)
		assert.ok(
			astNodes <= 400,
			`GET_MY_FPL_COMPETITIONS_DESK has ${astNodes} AST nodes`
		)
	})

	it('uses the bounded picker field instead of downloading the roster', async () => {
		const document = parse(SEARCH_PLAYERS_FOR_PICKER)
		const operation = document.definitions.find(
			definition => definition.kind === 'OperationDefinition'
		)
		assert.ok(operation?.kind === 'OperationDefinition')
		assert.equal(operation.selectionSet.selections.length, 1)
		const root = operation.selectionSet.selections[0]
		assert.ok(root?.kind === 'Field')
		assert.equal(root.name.value, 'playersForPicker')
		assert.match(SEARCH_PLAYERS_FOR_PICKER, /\$filter:\s*PlayersFilter/)
		assert.match(
			SEARCH_PLAYERS_FOR_PICKER,
			/\$ownershipBand:\s*PlayerPickerOwnershipBand/
		)
		assert.match(SEARCH_PLAYERS_FOR_PICKER, /ownershipBand:\s*\$ownershipBand/)
		assert.match(SEARCH_PLAYERS_FOR_PICKER, /\$limit:\s*Int\s*=\s*20/)
		assert.match(SEARCH_PLAYERS_FOR_PICKER, /\btotalCount\b/)

		const pickerSource = await readFile(
			new URL(
				'../components/player/PlayerDirectoryPicker.tsx',
				import.meta.url
			),
			'utf8'
		)
		assert.match(pickerSource, /SEARCH_PLAYERS_FOR_PICKER/)
		assert.match(pickerSource, /setNextPlayersCursor/)
		assert.match(pickerSource, /const requestCursor = nextPlayersCursor/)
		assert.match(pickerSource, /cursor: requestCursor/)
		assert.match(pickerSource, /canLoadMorePlayers/)
		assert.match(
			pickerSource,
			/visiblePlayers\.length === 0 && !canLoadMorePlayers/
		)
		const loadMoreSource = pickerSource.slice(
			pickerSource.indexOf('const loadMorePlayers'),
			pickerSource.indexOf('const visiblePlayers')
		)
		assert.match(loadMoreSource, /setMorePlayersError/)
		assert.doesNotMatch(loadMoreSource, /setError\(/)
		assert.doesNotMatch(pickerSource, /GET_PLAYERS_FOR_PICKER/)
	})

	it('keeps tournament authorization and participant details in separate operations', () => {
		assert.doesNotMatch(GET_TOURNAMENT_METADATA, /tournamentParticipants/)
		assert.doesNotMatch(GET_TOURNAMENT_PARTICIPANTS, /\btournament\s*\(/)
	})

	it('keeps official H2H detail and Team Desk queries below the production guard', () => {
		for (const [name, query] of [
			['GET_TOURNAMENT_OFFICIAL_H2H', GET_TOURNAMENT_OFFICIAL_H2H],
			['GET_ENTRY_OFFICIAL_H2H_DESK', GET_ENTRY_OFFICIAL_H2H_DESK],
			['GET_ENTRY_OFFICIAL_H2H_MATCHUPS', GET_ENTRY_OFFICIAL_H2H_MATCHUPS]
		] as const) {
			const document = parse(query)
			let astNodes = 0
			visit(document, { enter: () => void (astNodes += 1) })
			assert.ok(astNodes < 200, `${name} has ${astNodes} AST nodes`)
		}
	})

	it('keeps the combined tournament detail desk within its dedicated AST guard', () => {
		const document = parse(GET_TOURNAMENT_DETAIL_DESK)
		let astNodes = 0
		visit(document, { enter: () => void (astNodes += 1) })
		assert.ok(
			astNodes <= 400,
			`GET_TOURNAMENT_DETAIL_DESK has ${astNodes} AST nodes; backend detail-desk limit is 400`
		)
	})

	it('keeps the live tournament desk below the production guard', () => {
		const document = parse(GET_TOURNAMENT_LIVE_DESK)
		let astNodes = 0
		visit(document, { enter: () => void (astNodes += 1) })
		assert.ok(
			astNodes <= 200,
			`GET_TOURNAMENT_LIVE_DESK has ${astNodes} AST nodes; backend limit is 200`
		)
	})
})
