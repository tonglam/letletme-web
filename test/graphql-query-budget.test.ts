import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parse, visit } from 'graphql'
import { GET_LIVE_MATCHES } from '../lib/graphql/queries'

describe('GraphQL request budget', () => {
	it('keeps GET_LIVE_MATCHES below the production 200-node guard', () => {
		const document = parse(GET_LIVE_MATCHES)
		let astNodes = 0
		visit(document, { enter: () => void (astNodes += 1) })

		assert.ok(astNodes < 200, `GET_LIVE_MATCHES has ${astNodes} AST nodes`)
	})
})
