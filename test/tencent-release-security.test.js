const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')

const deployRelease = fs.readFileSync(
	'ops/tencent/scripts/deploy-release.sh',
	'utf8'
)
const releaseWrapper = fs.readFileSync(
	'ops/tencent/scripts/letletme-release-wrapper.sh',
	'utf8'
)
const releaseWorkflow = fs.readFileSync(
	'.github/workflows/release-web.yml',
	'utf8'
)

test('Tencent stage validates prebuilt output without installing or compiling', () => {
	assert.doesNotMatch(deployRelease, /npm (?:ci|run build)/)
	assert.match(deployRelease, /letletme-release-tools\/prebuilt-release\.mjs "\$1" "\$2"/)
	assert.match(deployRelease, /install -d -o root -g root -m 0700 "\$build_dir"/)
	assert.ok(deployRelease.indexOf('prebuilt-release.mjs') < deployRelease.indexOf('rsync -a "$build_dir/.next/standalone/"'))
})

test('steady-state Tencent builds do not propagate the retired proxy secret', () => {
	assert.doesNotMatch(
		deployRelease,
		/LETLETME_LOCAL_PROXY_SECRET_PREVIOUS/
	)
})

test('release workflow requires the matching host tooling revision', () => {
	const [, toolingRevision] = releaseWrapper.match(/tooling_revision=(\d+-\d+)/) ?? []
	assert.ok(toolingRevision, 'release wrapper must declare a tooling revision')
	assert.ok(
		releaseWorkflow.includes(`letletme-release-tooling ${toolingRevision}`),
		'release workflow must require the installed wrapper revision'
	)
})
