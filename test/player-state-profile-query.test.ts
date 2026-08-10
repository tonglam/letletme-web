import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parse, visit } from 'graphql'
import {
	GET_PLAYER_EVIDENCE_FIXTURES,
	GET_PLAYER_EVIDENCE_PROCESS,
	GET_PLAYER_EVIDENCE_PRODUCTION,
	GET_PLAYER_EVIDENCE_RECENT,
	GET_PLAYER_STATE_CONTEXT,
	GET_PLAYER_STATE_PROFILE
} from '../lib/graphql/operations/players'

describe('Player State Profile query', () => {
	it('stays inside the GraphQL document guard used by the API', () => {
		let astNodes = 0
		visit(parse(GET_PLAYER_STATE_PROFILE), {
			enter: () => {
				astNodes += 1
			}
		})

		assert.ok(astNodes <= 200, `Profile query has ${astNodes} AST nodes`)
		assert.doesNotMatch(GET_PLAYER_STATE_PROFILE, /ownBaseline/)
		assert.doesNotMatch(GET_PLAYER_STATE_PROFILE, /providers/)
	})

	it('loads low-frequency history and provider context through a bounded query', () => {
		let astNodes = 0
		visit(parse(GET_PLAYER_STATE_CONTEXT), {
			enter: () => {
				astNodes += 1
			}
		})

		assert.ok(astNodes <= 200, `Context query has ${astNodes} AST nodes`)
		assert.match(GET_PLAYER_STATE_CONTEXT, /ownBaseline/)
		assert.match(GET_PLAYER_STATE_CONTEXT, /providers/)
	})

	it('keeps evidence requests separated by user-selected tab', () => {
		assert.match(GET_PLAYER_EVIDENCE_FIXTURES, /fixtures \{/)
		assert.match(GET_PLAYER_EVIDENCE_RECENT, /recentGameweeks \{/)
		assert.match(GET_PLAYER_EVIDENCE_PRODUCTION, /goalsScored assists/)
		assert.match(GET_PLAYER_EVIDENCE_PROCESS, /expectedGoals expectedAssists/)
	})
})
