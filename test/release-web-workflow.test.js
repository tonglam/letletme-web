const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const workflow = fs.readFileSync(
	path.join(__dirname, '..', '.github', 'workflows', 'release-web.yml'),
	'utf8'
)

function extractVercelCommands(source) {
	const lines = source.split(/\r?\n/)
	const prefix = 'npx --yes "vercel@${VERCEL_CLI_VERSION}" '
	const commands = []

	for (let index = 0; index < lines.length; index += 1) {
		let command = lines[index].trim()
		if (!command.startsWith(prefix)) continue

		while (command.endsWith('\\')) {
			command = `${command.slice(0, -1).trimEnd()} ${lines[(index += 1)].trim()}`
		}
		commands.push(command)
	}

	return commands
}

test('Vercel CI uses the scoped project environment without relinking', () => {
	assert.doesNotMatch(
		workflow,
		/vercel@\$\{VERCEL_CLI_VERSION\}" link/,
		'VERCEL_ORG_ID and VERCEL_PROJECT_ID must replace interactive project linking in CI'
	)
	const vercelCommands = extractVercelCommands(workflow)
	assert.equal(vercelCommands.length, 4, 'the release must contain exactly four Vercel commands')
	for (const command of ['pull', 'build', 'deploy', 'promote']) {
		const matches = vercelCommands.filter((line) =>
			line.startsWith(`npx --yes "vercel@\${VERCEL_CLI_VERSION}" ${command} `)
		)
		assert.equal(matches.length, 1, `${command} must appear exactly once`)
		assert.match(
			matches[0],
			/(?:^|\s)--token "\$VERCEL_TOKEN"(?:\s|$)/,
			`${command} must use the restricted production token explicitly`
		)
	}
})
