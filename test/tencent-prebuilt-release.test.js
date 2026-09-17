const assert = require('node:assert/strict')
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const test = require('node:test')

const sha = 'a'.repeat(40)
const hostConfig = { publicEnvironment: {}, serverActionsKeySha256: 'b'.repeat(64) }
const platform = { platform: 'linux', arch: 'x64', versions: { node: '22.23.2' } }

async function fixture(run) {
	const { verifyPrebuiltRelease } = await import('../ops/tencent/scripts/prebuilt-release.mjs')
	const root = mkdtempSync(join(tmpdir(), 'tencent-prebuilt-'))
	const write = (name, value) => writeFileSync(join(root, name), typeof value === 'string' ? value : JSON.stringify(value))
	const manifest = { releaseSha: sha, origin: 'tencent', platform: 'linux', arch: 'x64', nodeMajor: 22, hostConfig }
	const config = { output: 'standalone', deploymentId: sha.slice(0, 32), env: { LETLETME_RELEASE_SHA: sha } }
	try {
		mkdirSync(join(root, '.next/standalone/.next'), { recursive: true })
		mkdirSync(join(root, '.next/static'))
		write('.letletme-build.json', manifest)
		for (const base of ['.next', '.next/standalone/.next']) {
			write(`${base}/required-server-files.json`, { config })
			write(`${base}/BUILD_ID`, 'build-id')
		}
		write('.next/standalone/server.js', 'throw new Error("must not execute")')
		await run({ root, write, manifest, config, verify: () => verifyPrebuiltRelease(root, sha, hostConfig, platform) })
	} finally { rmSync(root, { recursive: true, force: true }) }
}

test('accepts coherent signed-payload metadata without executing application code', () => fixture(({ verify }) => verify()))

test('rejects wrong release, origin, platform, Node version and host configuration', async () => {
	for (const change of [
		{ releaseSha: 'c'.repeat(40) }, { origin: 'overseas' }, { platform: 'darwin' },
		{ arch: 'arm64' }, { nodeMajor: 20 }, { hostConfig: { ...hostConfig, serverActionsKeySha256: 'changed' } }
	]) await fixture(({ write, manifest, verify }) => {
		write('.letletme-build.json', { ...manifest, ...change })
		assert.throws(verify)
	})
})

test('rejects contradictory compiled identity and mismatched build IDs', async () => {
	await fixture(({ write, config, verify }) => {
		write('.next/standalone/.next/required-server-files.json', { config: { ...config, deploymentId: 'wrong' } })
		assert.throws(verify)
	})
	await fixture(({ write, verify }) => { write('.next/BUILD_ID', 'different'); assert.throws(verify) })
})

test('rejects incomplete output', () => fixture(({ root, verify }) => {
	rmSync(join(root, '.next/standalone/server.js'))
	assert.throws(verify)
}))
