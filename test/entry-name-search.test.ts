import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { SEARCH_ENTRIES } from '../lib/graphql/operations/entries'

describe('web entry name search', () => {
	it('uses the public SearchEntries operation on bind and rebind forms', () => {
		const bind = readFileSync('app/onboarding/bind-entry/BindEntryForm.tsx', 'utf8')
		const rebind = readFileSync('app/profile/RebindEntryForm.tsx', 'utf8')
		const onboarding = readFileSync(
			'app/[locale]/onboarding/bind-entry/page.tsx',
			'utf8'
		)
		assert.match(SEARCH_ENTRIES, /query SearchEntries/)
		assert.match(bind, /classifyEntryLookupInput/)
		assert.match(bind, /useEntryNameSearch/)
		assert.match(rebind, /useEntryNameSearch/)
		assert.match(rebind, /coverageHint/)
		assert.match(onboarding, /findByName/)
		assert.match(onboarding, /nameStepThree/)
	})
})
