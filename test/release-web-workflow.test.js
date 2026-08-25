const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const workflow = fs.readFileSync(
	path.join(__dirname, '..', '.github', 'workflows', 'release-web.yml'),
	'utf8'
)

test('Vercel CI uses the scoped project environment without relinking', () => {
	assert.doesNotMatch(
		workflow,
		/vercel@\$\{VERCEL_CLI_VERSION\}" link/,
		'VERCEL_ORG_ID and VERCEL_PROJECT_ID must replace interactive project linking in CI'
	)
	for (const command of ['pull', 'build', 'deploy', 'promote']) {
		assert.match(
			workflow,
			new RegExp(`vercel@\\$\\{VERCEL_CLI_VERSION\\}\\" ${command}[\\s\\S]*?--token \\\"\\$VERCEL_TOKEN\\\"`),
			`${command} must use the restricted production token explicitly`
		)
	}
})
