import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { parse, visit } from 'graphql'
import {
	GET_EVENT_LIVE_EXPLAINS,
	GET_LIVE_MATCHES
} from '../lib/graphql/operations/live'
import { GET_MARKET_PULSE } from '../lib/graphql/operations/market'
import {
	GET_PLAYER_STATE_PROFILE,
	SEARCH_PLAYERS_FOR_PICKER
} from '../lib/graphql/operations/players'
import {
	GET_TOURNAMENT_METADATA,
	GET_TOURNAMENT_PARTICIPANTS
} from '../lib/graphql/operations/tournaments'

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

	it('keeps GET_LIVE_MATCHES below the production 200-node guard', () => {
		const document = parse(GET_LIVE_MATCHES)
		let astNodes = 0
		visit(document, { enter: () => void (astNodes += 1) })

		assert.ok(astNodes < 200, `GET_LIVE_MATCHES has ${astNodes} AST nodes`)
	})

	it('keeps GET_MARKET_PULSE below the production 200-node guard', () => {
		const document = parse(GET_MARKET_PULSE)
		let astNodes = 0
		visit(document, { enter: () => void (astNodes += 1) })

		assert.ok(astNodes < 200, `GET_MARKET_PULSE has ${astNodes} AST nodes`)
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
			astNodes < 200,
			`GET_PLAYER_STATE_PROFILE has ${astNodes} AST nodes`
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
		assert.match(pickerSource, /cursor: nextPlayersCursor/)
		assert.match(pickerSource, /canLoadMorePlayers/)
		assert.match(
			pickerSource,
			/visiblePlayers\.length === 0 && !canLoadMorePlayers/
		)
		assert.doesNotMatch(pickerSource, /GET_PLAYERS_FOR_PICKER/)
	})

	it('keeps tournament authorization and participant details in separate operations', () => {
		assert.doesNotMatch(GET_TOURNAMENT_METADATA, /tournamentParticipants/)
		assert.doesNotMatch(GET_TOURNAMENT_PARTICIPANTS, /\btournament\s*\(/)
	})
})
