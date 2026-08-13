import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

describe('login SSR boundary', () => {
	it('keeps the complete form in the server-rendered client tree', async () => {
		const [page, client] = await Promise.all([
			readFile(new URL('../../app/[locale]/auth/login/page.tsx', import.meta.url), 'utf8'),
			readFile(new URL('../../app/auth/login/LoginClient.tsx', import.meta.url), 'utf8')
		])
		assert.match(page, /getSafeInternalHref/)
		assert.match(page, /reason={reason}/)
		assert.doesNotMatch(client, /useSearchParams/)
		assert.doesNotMatch(client, /<Suspense/)
		assert.match(client, /<form/)
		assert.match(client, /type="email"/)
		assert.match(client, /type="password"/)
	})
})
