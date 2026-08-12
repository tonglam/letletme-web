import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('runs Web Functions beside the Singapore database', async () => {
	const config = JSON.parse(await readFile('vercel.json', 'utf8')) as {
		regions?: string[]
	}

	assert.deepEqual(config.regions, ['sin1'])
})
