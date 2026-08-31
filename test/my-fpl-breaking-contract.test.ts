import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
	GET_MY_FPL_MANAGER_GAMEWEEK,
	GET_MY_FPL_MANAGER_REVIEW
} from '@/lib/graphql/operations/my-fpl'

describe('My FPL breaking Manager Review contract', () => {
	it('contains only the new personal roots', () => {
		const document = `${GET_MY_FPL_MANAGER_REVIEW}\n${GET_MY_FPL_MANAGER_GAMEWEEK}`
		assert.match(document, /myFplManagerReview/)
		assert.match(document, /myFplManagerGameweek/)
		assert.doesNotMatch(
			document,
			/myFplTeamDesk|myFplTeamGameweek|myFplTeamTransfers/
		)
	})

	it('does not retain the deleted response adapter', () => {
		assert.equal(existsSync('app/me/team/_lib/my-fpl-adapters.ts'), false)
	})

	it('restricts the visual QA mock bypass to the non-production manager page', () => {
		const proxySource = readFileSync('proxy.ts', 'utf8')
		assert.match(proxySource, /process\.env\.NODE_ENV !== 'production'/)
		assert.match(proxySource, /pathname === '\/my-fpl\/team'/)
		assert.match(proxySource, /searchParams\.get\('mock'\) === '1'/)
	})
})
