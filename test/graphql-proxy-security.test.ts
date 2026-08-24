import assert from 'node:assert/strict'
import test from 'node:test'

import { sanitizeGraphQLUpstreamBody } from '../lib/graphql-proxy-security'

test('GraphQL proxy removes upstream resolver details while retaining safe codes', () => {
	const sanitized = JSON.parse(
		sanitizeGraphQLUpstreamBody(
			JSON.stringify({
				data: null,
				errors: [
					{
						message: 'relation private_table does not exist',
						path: ['privateField'],
						extensions: {
							code: 'INTERNAL_SERVER_ERROR',
							detail: 'postgres://user:secret@example/db',
							stack: 'Error: private stack'
						}
					}
				]
			}),
			200
		)
	)

	assert.deepEqual(sanitized, {
		data: null,
		errors: [
			{
				message: 'The data service is unavailable.',
				extensions: { code: 'INTERNAL_SERVER_ERROR' }
			}
		]
	})
	assert.doesNotMatch(
		JSON.stringify(sanitized),
		/private_table|postgres:|private stack|secret/
	)
})

test('GraphQL proxy replaces malformed and non-OK upstream bodies', () => {
	const malformed = JSON.parse(
		sanitizeGraphQLUpstreamBody('upstream stack: password=secret', 502)
	)
	assert.deepEqual(malformed, {
		errors: [
			{
				message: 'The data service is unavailable.',
				extensions: { code: 'UPSTREAM_GRAPHQL_ERROR' }
			}
		]
	})

	const forbidden = JSON.parse(
		sanitizeGraphQLUpstreamBody(
			JSON.stringify({ error: 'database secret' }),
			403
		)
	)
	assert.deepEqual(forbidden, {
		errors: [
			{
				message: 'You are not allowed to view this data.',
				extensions: { code: 'FORBIDDEN' }
			}
		]
	})
})

test('GraphQL proxy safely preserves the no-viewer-entry contract', () => {
	const response = JSON.parse(
		sanitizeGraphQLUpstreamBody(
			JSON.stringify({
				data: null,
				errors: [
					{
						message: 'private resolver detail',
						extensions: {
							code: 'VIEWER_ENTRY_REQUIRED',
							stack: 'secret stack'
						}
					}
				]
			}),
			403
		)
	)

	assert.deepEqual(response, {
		data: null,
		errors: [
			{
				message: 'Please select your FPL team first.',
				extensions: { code: 'VIEWER_ENTRY_REQUIRED' }
			}
		]
	})
})
