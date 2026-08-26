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

test('Tencent builds pass secrets through a temporary env file, not process arguments', () => {
	assert.match(
		deployRelease,
		/build_env_file=\$\(mktemp "\/run\/letletme-build-env-\$release_sha\.XXXXXX"\)/
	)
	assert.match(deployRelease, /chmod 0600 "\$build_env_file"/)
	assert.match(deployRelease, /chown letletme:letletme "\$build_env_file"/)
	assert.match(deployRelease, /printf 'export %s=%q\\n'/)
	assert.match(deployRelease, /trap cleanup_build_env EXIT/)
	assert.match(
		deployRelease,
		/runuser --user letletme -- \/usr\/bin\/env -i \/bin\/bash --noprofile --norc -c/
	)
	assert.match(deployRelease, /letletme-build "\$build_env_file"/)
	assert.doesNotMatch(deployRelease, /\/usr\/bin\/env -i "\$\{build_env\[@\]\}"/)
	assert.doesNotMatch(deployRelease, /build_env\+=\(/)
})

test('release workflow requires the matching host tooling revision', () => {
	const [, toolingRevision] = releaseWrapper.match(/tooling_revision=(\d+-\d+)/) ?? []
	assert.ok(toolingRevision, 'release wrapper must declare a tooling revision')
	assert.ok(
		releaseWorkflow.includes(`letletme-release-tooling ${toolingRevision}`),
		'release workflow must require the installed wrapper revision'
	)
})
