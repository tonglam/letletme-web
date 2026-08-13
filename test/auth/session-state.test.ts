import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

describe('active-session state semantics', () => {
	it('renders reauthentication separately from empty and failed states', async () => {
		const source = await readFile(
			new URL('../../app/profile/sessions/SessionControls.tsx', import.meta.url),
			'utf8'
		)
		assert.match(source, /'loading'/)
		assert.match(source, /'ready'/)
		assert.match(source, /'reauth-required'/)
		assert.match(source, /SESSION_NOT_FRESH/)
		assert.match(
			source,
			/\/auth\/login\?next=\/profile\/sessions&reason=reauth/
		)
		const reauthBranch = source.slice(
			source.indexOf("if (state.status === 'reauth-required')"),
			source.indexOf("if (state.status === 'error')")
		)
		assert.doesNotMatch(reauthBranch, /t\('empty'\)/)
	})
})
