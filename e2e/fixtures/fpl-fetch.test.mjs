import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const fixture = new URL('./fpl-fetch.mjs', import.meta.url).href

test('FPL fixture intercepts server entry reads and rejects other FPL routes', () => {
	const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
		import assert from 'node:assert/strict';
		let delegated = 0;
		globalThis.fetch = async () => { delegated++; return Response.json({ passthrough: true }); };
		await import(${JSON.stringify(fixture)});
		for (const input of ['https://fantasy.premierleague.com/api/entry/123/', new Request('https://fantasy.premierleague.com/api/entry/123/')]) {
			assert.deepEqual(await (await fetch(input)).json(), { id: 123, name: 'E2E Synced United', player_first_name: 'Fixture', player_last_name: 'Manager' });
		}
		await assert.rejects(fetch('https://fantasy.premierleague.com/api/bootstrap-static/'));
		await assert.rejects(fetch('https://fantasy.premierleague.com/api/entry/123/', { method: 'POST' }));
		assert.equal(delegated, 0);
		assert.deepEqual(await (await fetch('http://127.0.0.1:4225/graphql')).json(), { passthrough: true });
		assert.equal(delegated, 1);
	`], { env: { ...process.env, E2E_DATABASE_URL: 'postgres://letletme_web_runtime@127.0.0.1:5437/isolated_test' }, encoding: 'utf8' })
	assert.equal(result.status, 0, result.stderr)
})

test('FPL fixture refuses a non-local database', () => {
	const result = spawnSync(process.execPath, ['--import', fixture, '-e', ''], { env: { ...process.env, E2E_DATABASE_URL: 'postgres://example.invalid/production' }, encoding: 'utf8' })
	assert.notEqual(result.status, 0)
	assert.match(result.stderr, /isolated loopback E2E database/)
})
