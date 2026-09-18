const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const { mkdtempSync, writeFileSync, chmodSync, readFileSync, existsSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..')

function invoke(suite, fail = false) {
	const temporary = mkdtempSync(path.join(tmpdir(), 'fixture-suite-'))
	const log = path.join(temporary, 'calls.jsonl')
	const stub = path.join(temporary, 'npx')
	writeFileSync(stub, `#!${process.execPath}
require('node:fs').appendFileSync(process.env.FIXTURE_LOG, JSON.stringify({args:process.argv.slice(2), briefing:process.env.BRIEFING_PUBLIC_ENABLED, fixture:process.env.E2E_LIVE_HYDRATION, horizon:process.env.E2E_NONTERMINAL_HORIZON, unpublished:process.env.E2E_TRENDS_UNPUBLISHED, ssr:process.env.E2E_SSR_REMEDIATION, existingBuild:process.env.PLAYWRIGHT_USE_EXISTING_BUILD, cwd:process.cwd()})+'\\n')
process.exit(process.env.FIXTURE_FAIL === '1' ? 17 : 0)
`)
	chmodSync(stub, 0o755)
	try {
		const result = spawnSync('bash', [path.join(root, 'e2e/run-fixture-suite.sh'), suite], {
			cwd: temporary,
			encoding: 'utf8',
			env: { ...process.env, PATH: `${temporary}:${process.env.PATH}`, FIXTURE_LOG: log, FIXTURE_FAIL: fail ? '1' : '0', E2E_LIVE_HYDRATION: '1' }
		})
		const calls = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line)) : []
		return { status: result.status, calls, stderr: result.stderr }
	} finally {
		rmSync(temporary, { recursive: true, force: true })
	}
}

test('SSR suite preserves selectors, serial execution and fixture environment', () => {
	const result = invoke('ssr')
	assert.equal(result.status, 0, result.stderr)
	assert.equal(result.calls.length, 4)
	assert.deepEqual(result.calls[1].args, ['playwright', 'test', 'e2e/nonterminal-horizon.spec.ts', '--workers=1', '--trace=on', '--output=test-results/horizon'])
	assert.equal(result.calls[1].horizon, '1')
	assert.equal(result.calls[1].existingBuild, '1')
	assert.equal(result.calls[1].fixture, '1')
	assert.equal(result.calls[1].cwd, root)
	assert.deepEqual(result.calls[0].args, ['playwright', 'test', 'e2e/home-personal.spec.ts', 'e2e/player-stats.spec.ts', '--grep', 'SSR remediation|SSR detail stream|canonical competition|personal league carousel|J19|J10|J08|J12', '--workers=1', '--trace=on'])
	assert.equal(result.calls[0].fixture, '1')
	assert.equal(result.calls[0].cwd, root)
	assert.deepEqual(result.calls[2].args, ['playwright', 'test', 'e2e/trends-unpublished.spec.ts', '--workers=1', '--trace=on', '--output=test-results/trends-unpublished'])
	assert.deepEqual(result.calls[3].args, ['playwright', 'test', 'e2e/home-personal.spec.ts', '--grep', 'TR03 planned.*unpublished', '--workers=1', '--trace=on', '--output=test-results/trends-unpublished-bound'])
	for (const call of result.calls.slice(2)) {
		assert.equal(call.unpublished, '1')
		assert.equal(call.existingBuild, '1')
		assert.equal(call.cwd, root)
	}
	assert.equal(result.calls[3].ssr, '1')
})

test('standalone horizon keeps build enabled and separates its artifacts', () => {
	const result = invoke('horizon')
	assert.equal(result.status, 0, result.stderr)
	assert.equal(result.calls[0].existingBuild, process.env.PLAYWRIGHT_USE_EXISTING_BUILD)
	assert.equal(result.calls[0].horizon, '1')
	assert.ok(result.calls[0].args.includes('--output=test-results/horizon'))
})

test('Briefing runs both feature states and keeps their outputs separate', () => {
	const result = invoke('briefing')
	assert.equal(result.status, 0, result.stderr)
	assert.deepEqual(result.calls.map(c => c.briefing), ['true', 'false'])
	assert.deepEqual(result.calls.map(c => c.args), [
		['playwright', 'test', 'e2e/briefing.spec.ts', '--grep-invert', 'feature-disabled', '--workers=1', '--trace=on', '--output=test-results/briefing-enabled'],
		['playwright', 'test', 'e2e/briefing.spec.ts', '--grep', 'feature-disabled', '--workers=1', '--trace=on', '--output=test-results/briefing-disabled']
	])
})

test('failed suites keep their exit code and do not continue after a failure', () => {
	for (const suite of ['ssr', 'briefing', 'horizon', 'trends-unpublished']) {
		const result = invoke(suite, true)
		assert.equal(result.status, 17)
		assert.equal(result.calls.length, 1)
	}
	const unknown = invoke('unknown')
	assert.equal(unknown.status, 2)
	assert.equal(unknown.calls.length, 0)
})

test('CI calls the isolated suites and suite edits use the verification-only release gate', async () => {
	const workflow = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8')
	assert.match(workflow, /run: bash e2e\/run-fixture-suite\.sh ssr/)
	assert.match(workflow, /run: bash e2e\/run-fixture-suite\.sh briefing/)
	const { decideVercelBuild } = await import('../scripts/vercel-ignore-build.mjs')
	const env = { VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main', VERCEL_GIT_PREVIOUS_SHA: '1'.repeat(40), VERCEL_GIT_COMMIT_SHA: '2'.repeat(40) }
	assert.equal(decideVercelBuild(env, () => ['e2e/run-fixture-suite.sh', 'e2e/briefing.spec.ts']).skip, true)
	assert.equal(decideVercelBuild(env, () => ['e2e/run-fixture-suite.sh', '.github/workflows/ci.yml']).skip, false)
})
