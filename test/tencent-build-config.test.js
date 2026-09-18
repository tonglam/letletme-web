const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const test = require('node:test')

const script = 'ops/tencent/scripts/build-config.mjs'
const key = Buffer.alloc(32, 17).toString('base64')
const run = (env) => spawnSync(process.execPath, [script], {
	env: { NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: key, ...env }, encoding: 'utf8'
})

test('build configuration returns only explicit public fields and a key digest', () => {
	const result = run({
		NEXT_PUBLIC_APP_URL: 'https://letletme.top',
		NEXT_PUBLIC_SUPABASE_URL: 'https://storage.example.invalid',
		DATABASE_URL: 'postgres://secret', BACKEND_PROXY_SECRET: 'proxy-secret',
		LETLETME_LOCAL_PROXY_SECRET: 'local-secret', NEXT_PUBLIC_UNKNOWN: 'unknown'
	})
	assert.equal(result.status, 0, result.stderr)
	const config = JSON.parse(result.stdout)
	assert.deepEqual(config.publicEnvironment, {
		NEXT_PUBLIC_APP_URL: 'https://letletme.top',
		NEXT_PUBLIC_SUPABASE_URL: 'https://storage.example.invalid'
	})
	assert.match(config.serverActionsKeySha256, /^[a-f0-9]{64}$/)
	for (const secret of [key, 'postgres://secret', 'proxy-secret', 'local-secret', 'unknown']) {
		assert.ok(!result.stdout.includes(secret))
	}
})

test('changed key or public configuration produces a different configuration', () => {
	const first = JSON.parse(run({}).stdout)
	const second = JSON.parse(run({ NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: Buffer.alloc(32, 18).toString('base64') }).stdout)
	assert.notEqual(first.serverActionsKeySha256, second.serverActionsKeySha256)
	assert.notDeepEqual(first, JSON.parse(run({ BETTER_AUTH_URL: 'https://letletme.top' }).stdout))
})

test('invalid keys and credential-bearing URLs fail without exposing values', () => {
	for (const env of [
		{ NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: '' },
		{ NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: 'secret-not-base64' },
		{ NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: Buffer.alloc(16).toString('base64') },
		{ NEXT_PUBLIC_APP_URL: 'https://user:password@example.invalid' },
		{ NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid?token=secret' },
		{ BETTER_AUTH_URL: 'not-a-url-secret' }
	]) {
		const result = run(env)
		assert.equal(result.status, 1)
		assert.equal(result.stdout, '')
		assert.equal(result.stderr, 'Invalid Tencent build configuration\n')
	}
})

test('CI build environment rejects key mismatch and excludes unrelated CI secrets', async () => {
	const { buildEnvironment } = await import('../ops/tencent/scripts/build-release.mjs')
	const host = JSON.parse(run({ NEXT_PUBLIC_APP_URL: 'https://letletme.top' }).stdout)
	const env = {
		NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: key,
		WEB_PRICE_CHANGE_LIVE_ENABLED: 'false', WEB_LIVE_REFRESH_PROFILE: 'conserve',
		TENCENT_RELEASE_SIGNING_KEY: 'must-not-reach-build', VERCEL_TOKEN: 'private',
		NODE_OPTIONS: '--require=/untrusted', DATABASE_URL: 'postgres://private'
	}
	const built = buildEnvironment(host, 'a'.repeat(40), env)
	assert.equal(built.LETLETME_ORIGIN, 'tencent')
	assert.equal(built.NEXT_PUBLIC_PRICE_CHANGE_LIVE_ENABLED, 'false')
	assert.equal(built.NEXT_PUBLIC_LIVE_REFRESH_PROFILE, 'conserve')
	assert.equal(built.NEXT_PUBLIC_APP_URL, 'https://letletme.top')
	for (const name of ['TENCENT_RELEASE_SIGNING_KEY', 'VERCEL_TOKEN', 'NODE_OPTIONS', 'DATABASE_URL']) {
		assert.equal(built[name], undefined)
	}
	assert.throws(() => buildEnvironment(host, 'a'.repeat(40), { ...env, NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: Buffer.alloc(32, 19).toString('base64') }), /SERVER_ACTIONS_KEY_MISMATCH/)
	assert.throws(() => buildEnvironment(host, 'a'.repeat(40), { ...env, WEB_LIVE_REFRESH_PROFILE: 'unknown' }))
	assert.throws(() => buildEnvironment({ ...host, publicEnvironment: { ...host.publicEnvironment, NODE_OPTIONS: 'injected' } }, 'a'.repeat(40), env), /HOST_CONFIG_MISMATCH/)
})


test('artifact CLI failure reports fixed stage without reflecting arguments', () => {
 const sentinel = 'secret-argument-must-not-appear'
 const result = spawnSync(process.execPath, ['ops/tencent/scripts/build-release.mjs', sentinel], { encoding: 'utf8' })
 assert.equal(result.status, 1)
 assert.equal(result.stdout, '')
 assert.equal(result.stderr, 'Tencent CI artifact build failed [arguments]\n')
 assert.ok(!result.stderr.includes(sentinel))
})
