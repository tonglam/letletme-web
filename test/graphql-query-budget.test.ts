import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parse, visit } from 'graphql'
import {
	GET_EVENT_LIVE_EXPLAINS,
	GET_LIVE_MATCHES
} from '../lib/graphql/operations/live'
import { GET_MARKET_PULSE } from '../lib/graphql/operations/market'

describe('GraphQL request budget', () => {
	it('uses one root field for the fifteen-player live explanation batch', () => {
		const document = parse(GET_EVENT_LIVE_EXPLAINS)
		const operation = document.definitions.find(
			definition => definition.kind === 'OperationDefinition'
		)
		assert.ok(operation?.kind === 'OperationDefinition')
		assert.equal(operation.selectionSet.selections.length, 1)
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
})
