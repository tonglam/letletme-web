import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { readBuildConfig } from './build-config.mjs'
import { verifyPrebuiltRelease } from './prebuilt-release.mjs'

export function buildEnvironment(hostConfig, sha, env) {
	assert.match(sha, /^[a-f0-9]{40}$/)
	const configuration = {
		...hostConfig.publicEnvironment,
		NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
	}
	const actualConfig = readBuildConfig(configuration)
	if (actualConfig.serverActionsKeySha256 !== hostConfig.serverActionsKeySha256) throw new Error('SERVER_ACTIONS_KEY_MISMATCH')
	if (!isDeepStrictEqual(actualConfig, hostConfig)) throw new Error('HOST_CONFIG_MISMATCH')
	assert.ok(['true', 'false'].includes(env.WEB_PRICE_CHANGE_LIVE_ENABLED))
	assert.ok(['normal', 'conserve', 'manual'].includes(env.WEB_LIVE_REFRESH_PROFILE))
	return {
		...configuration,
		NODE_ENV: 'production',
		LETLETME_ORIGIN: 'tencent',
		LETLETME_RELEASE_SHA: sha,
		NEXT_DEPLOYMENT_ID: sha.slice(0, 32),
		NEXT_PUBLIC_PRICE_CHANGE_LIVE_ENABLED: env.WEB_PRICE_CHANGE_LIVE_ENABLED,
		NEXT_PUBLIC_LIVE_REFRESH_PROFILE: env.WEB_LIVE_REFRESH_PROFILE,
		NEXT_TELEMETRY_DISABLED: '1'
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	let stage = 'arguments'
	try {
		assert.equal(process.argv.length, 5)
		const [root, sha, configPath] = process.argv.slice(2)
		stage = 'platform'
		assert.equal(process.platform, 'linux')
		assert.equal(process.arch, 'x64')
		assert.equal(Number(process.versions.node.split('.')[0]), 22)
		stage = 'clean-output'
		assert.ok(!existsSync(join(root, '.next')), 'build must start without previous output')
		stage = 'host-config-read'
		const hostConfig = JSON.parse(readFileSync(configPath, 'utf8'))
		stage = 'build-environment'
		const buildEnv = buildEnvironment(hostConfig, sha, process.env)
		// Do not forward CI signing, SSH, Vercel, GitHub, or runtime credentials.
		const baseEnv = { PATH: process.env.PATH, HOME: process.env.HOME, CI: 'true' }
		const run = (args, env) => {
			const result = spawnSync('npm', args, { cwd: root, env, stdio: 'inherit' })
			assert.equal(result.status, 0, 'Tencent CI build command failed')
		}
		stage = 'dependency-install'
		run(['ci', '--include=dev'], baseEnv)
		stage = 'next-build'
		run(['run', 'build'], { ...baseEnv, ...buildEnv })
		stage = 'artifact-validation'
		writeFileSync(join(root, '.letletme-build.json'), JSON.stringify({
			releaseSha: sha, origin: 'tencent', platform: process.platform,
			arch: process.arch, nodeMajor: 22, hostConfig
		}) + '\n')
		writeFileSync(join(root, '.letletme-release-sha'), sha + '\n')
		verifyPrebuiltRelease(root, sha, hostConfig)
	} catch (error) {
		const code = ['SERVER_ACTIONS_KEY_MISMATCH', 'HOST_CONFIG_MISMATCH'].includes(error?.message) ? error.message : stage
		// Only fixed codes: never print exception messages, configuration or secrets.
		process.stderr.write(`Tencent CI artifact build failed [${code}]\n`)
		process.exitCode = 1
	}
}
