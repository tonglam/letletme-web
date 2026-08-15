const assert = require('node:assert/strict')
const test = require('node:test')

test('uses one Git SHA for the build and its Vercel-safe prefix for skew protection', async () => {
	const names = [
		'LETLETME_RELEASE_SHA',
		'VERCEL_GIT_COMMIT_SHA',
		'GITHUB_SHA',
		'VERCEL',
		'LETLETME_ORIGIN'
	]
	const previous = Object.fromEntries(
		names.map(name => [name, process.env[name]])
	)
	process.env.LETLETME_RELEASE_SHA = '0123456789abcdef0123456789abcdef01234567'
	process.env.LETLETME_ORIGIN = 'tencent'
	try {
		delete process.env.VERCEL_GIT_COMMIT_SHA
		delete process.env.GITHUB_SHA
		delete process.env.VERCEL
		delete require.cache[require.resolve('../next.config.js')]
		const config = require('../next.config.js')
		assert.equal(
			await config.generateBuildId(),
			'0123456789abcdef0123456789abcdef01234567'
		)
		assert.equal(
			config.deploymentId,
			'0123456789abcdef0123456789abcdef'
		)
		assert.ok(config.deploymentId.length <= 32)
		assert.equal(config.output, 'standalone')
		const rules = await config.headers()
		assert.deepEqual(rules[0].headers, [
			{ key: 'X-Letletme-Origin', value: 'tencent' },
			{
				key: 'X-Letletme-Release',
				value: '0123456789abcdef0123456789abcdef01234567'
			}
		])
	} finally {
		for (const name of names) {
			if (previous[name] === undefined) delete process.env[name]
			else process.env[name] = previous[name]
		}
		delete require.cache[require.resolve('../next.config.js')]
	}
})

test('prefers the Vercel Git SHA over a stale explicit release override', async () => {
	const names = ['LETLETME_RELEASE_SHA', 'VERCEL_GIT_COMMIT_SHA', 'VERCEL']
	const previous = Object.fromEntries(
		names.map(name => [name, process.env[name]])
	)
	try {
		process.env.LETLETME_RELEASE_SHA =
			'28941010a5b6806c60c404d25938c7e816ef85b4'
		process.env.VERCEL_GIT_COMMIT_SHA =
			'37973bbabbcafbe84714500c629d00935925eee6'
		process.env.VERCEL = '1'
		delete require.cache[require.resolve('../next.config.js')]
		const config = require('../next.config.js')
		assert.equal(
			await config.generateBuildId(),
			'37973bbabbcafbe84714500c629d00935925eee6'
		)
		assert.equal(
			config.deploymentId,
			'37973bbabbcafbe84714500c629d0093'
		)
	} finally {
		for (const name of names) {
			if (previous[name] === undefined) delete process.env[name]
			else process.env[name] = previous[name]
		}
		delete require.cache[require.resolve('../next.config.js')]
	}
})

test('rejects a Vercel build that has no immutable release SHA', () => {
	const names = [
		'LETLETME_RELEASE_SHA',
		'VERCEL_GIT_COMMIT_SHA',
		'GITHUB_SHA',
		'VERCEL'
	]
	const previous = Object.fromEntries(
		names.map(name => [name, process.env[name]])
	)
	try {
		delete process.env.LETLETME_RELEASE_SHA
		delete process.env.VERCEL_GIT_COMMIT_SHA
		delete process.env.GITHUB_SHA
		process.env.VERCEL = '1'
		delete require.cache[require.resolve('../next.config.js')]
		assert.throws(
			() => require('../next.config.js'),
			/require VERCEL_GIT_COMMIT_SHA or an explicit LETLETME_RELEASE_SHA/
		)
	} finally {
		for (const name of names) {
			if (previous[name] === undefined) delete process.env[name]
			else process.env[name] = previous[name]
		}
		delete require.cache[require.resolve('../next.config.js')]
	}
})
