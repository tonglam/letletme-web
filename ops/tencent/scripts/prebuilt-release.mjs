import assert from 'node:assert/strict'
import { readFileSync, lstatSync, readdirSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readBuildConfig } from './build-config.mjs'

// This runs after archive signature verification, before accepting its output.
// Never execute a module from the prebuilt application to validate its identity.
export function verifyPrebuiltRelease(root, sha, hostConfig, platform = process) {
	assert.match(sha, /^[a-f0-9]{40}$/)
	const json = (name) => JSON.parse(readFileSync(join(root, name), 'utf8'))
	const manifest = json('.letletme-build.json')
	assert.equal(manifest.releaseSha, sha, 'prebuilt release SHA mismatch')
	assert.equal(manifest.origin, 'tencent', 'prebuilt origin mismatch')
	assert.equal(manifest.platform, platform.platform, 'prebuilt OS mismatch')
	assert.equal(manifest.arch, platform.arch, 'prebuilt architecture mismatch')
	assert.equal(manifest.nodeMajor, Number(platform.versions.node.split('.')[0]), 'prebuilt Node major mismatch')
	assert.deepEqual(manifest.hostConfig, hostConfig, 'host build configuration changed')
	for (const base of ['.next', '.next/standalone/.next']) {
		const config = json(`${base}/required-server-files.json`).config
		assert.equal(config.output, 'standalone')
		assert.equal(config.deploymentId, sha.slice(0, 32), 'deployment ID mismatch')
		assert.equal(config.env.LETLETME_RELEASE_SHA, sha, 'compiled release SHA mismatch')
	}
	for (const name of ['.next/standalone/server.js', '.next/BUILD_ID', '.next/standalone/.next/BUILD_ID']) {
		assert.ok(lstatSync(join(root, name)).isFile(), `missing regular build file: ${name}`)
	}
	assert.equal(readFileSync(join(root, '.next/BUILD_ID'), 'utf8'), readFileSync(join(root, '.next/standalone/.next/BUILD_ID'), 'utf8'))
	assert.ok(readFileSync(join(root, '.next/BUILD_ID'), 'utf8').trim(), 'empty build ID')
	assert.ok(lstatSync(join(root, '.next/static')).isDirectory(), 'missing static assets')
	const hasFile = (directory) => readdirSync(directory, { withFileTypes: true }).some(
		(entry) => entry.isFile() || (entry.isDirectory() && hasFile(join(directory, entry.name)))
	)
	assert.ok(hasFile(join(root, '.next/static')), 'empty static assets')
	const standalone = resolve(root, '.next/standalone')
	const requiredFiles = json('.next/standalone/.next/required-server-files.json').files
	assert.ok(Array.isArray(requiredFiles) && requiredFiles.length > 0, 'missing required file manifest')
	for (const name of requiredFiles) {
		assert.equal(typeof name, 'string')
		assert.match(name, /^\.next\//)
		const file = resolve(standalone, name)
		assert.ok(file.startsWith(standalone + sep), 'required file escapes standalone output')
		assert.ok(lstatSync(file).isFile(), 'required runtime file is absent or not a regular file')
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		assert.equal(process.argv.length, 4)
		verifyPrebuiltRelease(process.argv[2], process.argv[3], readBuildConfig(process.env))
	} catch {
		// Assertion diffs could otherwise expose host configuration values.
		process.stderr.write('Tencent prebuilt release validation failed\n')
		process.exitCode = 1
	}
}
