import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const read = (path: string) =>
	readFile(new URL(`../${path}`, import.meta.url), 'utf8')

describe('data governance consumer probe contract', () => {
	it('requires ready market evidence and a canonical, matching live revision', async () => {
		const source = await read('lib/data-governance-probe.ts')
		assert.match(source, /market\.status === 'READY'/)
		assert.match(source, /if \(desk\.liveRevision === null\)/)
		assert.match(source, /desk\.season !== expectedSeason/)
		assert.doesNotMatch(
			source,
			/revision\(desk\.liveRevision \?\? desk\.coreRevision\)/
		)
	})

	it('does not follow redirects while sending the Data API credential', async () => {
		const source = await read('lib/data-governance-client.ts')
		assert.match(source, /redirect: 'error'/)
	})
})
