const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const PREVIOUS_SHA = '1'.repeat(40)
const CURRENT_SHA = '2'.repeat(40)

async function loadModule() {
	return import('../scripts/vercel-ignore-build.mjs')
}

function productionEnv(overrides = {}) {
	return {
		VERCEL_ENV: 'production',
		VERCEL_GIT_COMMIT_REF: 'main',
		VERCEL_GIT_PREVIOUS_SHA: PREVIOUS_SHA,
		VERCEL_GIT_COMMIT_SHA: CURRENT_SHA,
		...overrides
	}
}

test('Vercel disables every non-main Git branch including names with slashes', () => {
	const config = JSON.parse(
		readFileSync(path.resolve(__dirname, '../vercel.json'), 'utf8')
	)

	assert.deepEqual(config.git.deploymentEnabled, {
		'**': false,
		main: true
	})
	assert.equal(
		config.ignoreCommand,
		'node scripts/vercel-ignore-build.mjs'
	)
})

test('recognizes only the explicit documentation allowlist', async () => {
	const { isDocumentationPath } = await loadModule()
	for (const file of [
		'docs/release/README.md',
		'docs/images/diagram.png',
		'ops/edgeone/README.md',
		'ops/edgeone/evidence/result.MD',
		'README.md'
	]) {
		assert.equal(isDocumentationPath(file), true, file)
	}

	for (const file of [
		'ops/redis/scripts/backup.sh',
		'scripts/release.mjs',
		'vercel.json',
		'.github/workflows/ci.yml',
		'app/healthz/route.ts',
		'../README.md',
		'docs\\README.md'
	]) {
		assert.equal(isDocumentationPath(file), false, file)
	}
})

test('skips a production main deployment when every changed file is documentation', async () => {
	const { decideVercelBuild } = await loadModule()
	const decision = decideVercelBuild(productionEnv(), (previous, current) => {
		assert.equal(previous, PREVIOUS_SHA)
		assert.equal(current, CURRENT_SHA)
		return [
			'ops/edgeone/README.md',
			'ops/edgeone/evidence/2026-08-15-mainland-probe.md'
		]
	})

	assert.equal(decision.skip, true)
	assert.match(decision.reason, /all 2 changed files are documentation/)
})

test('builds when the full previous-successful-deployment diff contains runtime code', async () => {
	const { decideVercelBuild } = await loadModule()
	const decision = decideVercelBuild(productionEnv(), () => [
		'docs/release.md',
		'app/healthz/route.ts'
	])

	assert.equal(decision.skip, false)
	assert.match(decision.reason, /app\/healthz\/route\.ts/)
})

test('builds for an operations script even though operations Markdown is allowed', async () => {
	const { decideVercelBuild } = await loadModule()
	const decision = decideVercelBuild(productionEnv(), () => [
		'ops/edgeone/README.md',
		'ops/tencent/scripts/deploy-release.sh'
	])

	assert.equal(decision.skip, false)
	assert.match(decision.reason, /deploy-release\.sh/)
})

test('a manual force flag always builds without evaluating Git history', async () => {
	const { decideVercelBuild } = await loadModule()
	let diffRead = false
	const decision = decideVercelBuild(
		productionEnv({ LETLETME_FORCE_VERCEL_BUILD: '1' }),
		() => {
			diffRead = true
			return ['README.md']
		}
	)

	assert.equal(decision.skip, false)
	assert.equal(diffRead, false)
	assert.match(decision.reason, /forced/)
})

test('preview and non-main environments fail open to a build', async () => {
	const { decideVercelBuild } = await loadModule()
	assert.equal(
		decideVercelBuild(productionEnv({ VERCEL_ENV: 'preview' })).skip,
		false
	)
	assert.equal(
		decideVercelBuild(
			productionEnv({ VERCEL_GIT_COMMIT_REF: 'codex/example' })
		).skip,
		false
	)
})

test('missing or invalid immutable Git SHAs fail open to a build', async () => {
	const { decideVercelBuild } = await loadModule()
	for (const overrides of [
		{ VERCEL_GIT_PREVIOUS_SHA: undefined },
		{ VERCEL_GIT_COMMIT_SHA: 'abc123' },
		{ VERCEL_GIT_PREVIOUS_SHA: CURRENT_SHA }
	]) {
		assert.equal(decideVercelBuild(productionEnv(overrides)).skip, false)
	}
})

test('missing shallow-clone history and an empty diff fail open to a build', async () => {
	const { decideVercelBuild } = await loadModule()
	const shallow = decideVercelBuild(productionEnv(), () => {
		throw new Error('missing commit in shallow clone')
	})
	const empty = decideVercelBuild(productionEnv(), () => [])

	assert.equal(shallow.skip, false)
	assert.match(shallow.reason, /shallow clone/)
	assert.equal(empty.skip, false)
	assert.match(empty.reason, /empty or unavailable/)
})

test('Git diff lookup validates both commits and compares the complete SHA range', async () => {
	const { listGitChangedFiles } = await loadModule()
	const calls = []
	const files = listGitChangedFiles(PREVIOUS_SHA, CURRENT_SHA, (command, args) => {
		calls.push([command, args])
		if (args[0] === 'diff') return 'README.md\nops/edgeone/README.md\n'
		return ''
	})

	assert.deepEqual(files, ['README.md', 'ops/edgeone/README.md'])
	assert.deepEqual(calls, [
		['git', ['cat-file', '-e', `${PREVIOUS_SHA}^{commit}`]],
		['git', ['cat-file', '-e', `${CURRENT_SHA}^{commit}`]],
		[
			'git',
			['diff', '--name-only', '--no-renames', PREVIOUS_SHA, CURRENT_SHA, '--']
		]
	])
})

test('the configured script entrypoint prints a decision and uses Vercel exit semantics', () => {
	const result = spawnSync(
		process.execPath,
		['scripts/vercel-ignore-build.mjs'],
		{
			cwd: path.resolve(__dirname, '..'),
			encoding: 'utf8',
			env: { ...process.env, VERCEL_ENV: 'preview' }
		}
	)

	assert.equal(result.status, 1)
	assert.match(result.stdout, /\[vercel-ignore\] BUILD: environment is preview/)
})
