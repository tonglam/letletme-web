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
	assert.ok(
		vercelCommands.length >= 4,
		'the release must contain the candidate deploy, inspect, health curl, and promote commands'
	)
	for (const command of ['deploy', 'inspect', 'promote']) {
		const matches = vercelCommands.filter(line =>
			line.startsWith(`npx --yes "vercel@\${VERCEL_CLI_VERSION}" ${command} `)
		)
		assert.equal(matches.length, 1, `${command} must appear exactly once`)
		assert.match(
			matches[0],
			/(?:^|\s)--token "\$VERCEL_TOKEN"(?:\s|$)/,
			`${command} must use the restricted production token explicitly`
		)
	}
	const curlCommands = vercelCommands.filter(line =>
		line.startsWith('npx --yes "vercel@${VERCEL_CLI_VERSION}" curl ')
	)
	assert.ok(curlCommands.length >= 1, 'the candidate health curl must exist')
	for (const command of curlCommands) {
		assert.match(
			command,
			/(?:^|\s)--token "\$VERCEL_TOKEN"(?:\s|$)/,
			'candidate curl must use the restricted production token explicitly'
		)
		assert.match(
			command,
			/(?:^|\s)--deployment "\$candidate_url"(?:\s|$)/,
			'candidate curl must target the staged deployment'
		)
	}
	const promoteCommand = vercelCommands.find(line =>
		line.startsWith('npx --yes "vercel@${VERCEL_CLI_VERSION}" promote ')
	)
	assert.match(
		promoteCommand,
		/(?:^|\s)--scope "\$VERCEL_ORG_ID"(?:\s|$)/,
		'promotion must resolve the same restricted team that owns the candidate'
	)
})

test('Vercel candidate uses a remote unaliased Production build', () => {
	const [deployCommand] = extractVercelCommands(workflow).filter(line =>
		line.startsWith('npx --yes "vercel@${VERCEL_CLI_VERSION}" deploy ')
	)

	assert.ok(deployCommand, 'the staged remote deployment command must exist')
	assert.match(deployCommand, /(?:^|\s)--prod(?:\s|$)/)
	assert.match(deployCommand, /(?:^|\s)--skip-domain(?:\s|$)/)
	assert.match(deployCommand, /(?:^|\s)--no-wait(?:\s|$)/)
	assert.match(deployCommand, /(?:^|\s)--force(?:\s|$)/)
	assert.match(
		deployCommand,
		/(?:^|\s)--build-env "LETLETME_RELEASE_SHA=\$RELEASE_SHA"(?:\s|$)/
	)
	assert.match(
		deployCommand,
		/(?:^|\s)--env "LETLETME_RELEASE_SHA=\$RELEASE_SHA"(?:\s|$)/
	)
	assert.match(
		deployCommand,
		/(?:^|\s)--build-env "NEXT_PUBLIC_PRICE_CHANGE_LIVE_ENABLED=\$WEB_PRICE_CHANGE_LIVE_ENABLED"(?:\s|$)/
	)
	assert.match(
		deployCommand,
		/(?:^|\s)--build-env "NEXT_PUBLIC_LIVE_REFRESH_PROFILE=\$WEB_LIVE_REFRESH_PROFILE"(?:\s|$)/
	)
	assert.match(
		deployCommand,
		/(?:^|\s)--env "NEXT_PUBLIC_PRICE_CHANGE_LIVE_ENABLED=\$WEB_PRICE_CHANGE_LIVE_ENABLED"(?:\s|$)/
	)
	assert.match(
		deployCommand,
		/(?:^|\s)--env "NEXT_PUBLIC_LIVE_REFRESH_PROFILE=\$WEB_LIVE_REFRESH_PROFILE"(?:\s|$)/
	)
	assert.match(deployCommand, /(?:^|\s)--meta "gitSha=\$RELEASE_SHA"(?:\s|$)/)
	assert.doesNotMatch(deployCommand, /(?:^|\s)--prebuilt(?:\s|$)/)
	assert.doesNotMatch(
		workflow,
		/vercel@\$\{VERCEL_CLI_VERSION\}" (?:pull|build)(?:\s|\\)/
	)
})

test('signed Tencent release archive carries the same public live flag', () => {
	assert.match(
		workflow,
		/printf 'NEXT_PUBLIC_PRICE_CHANGE_LIVE_ENABLED=%s\\nNEXT_PUBLIC_LIVE_REFRESH_PROFILE=%s\\n'/
	)
	assert.match(
		workflow,
		/"\$WEB_PRICE_CHANGE_LIVE_ENABLED" "\$WEB_LIVE_REFRESH_PROFILE" > "\$tmp_root\/\.env\.production"/
	)
	assert.match(
		workflow,
		/tar --append --file="\$tmp_root\/release\.tar" -C "\$tmp_root" \.env\.production/
	)
	assert.match(
		workflow,
		/identical client bundle without copying any host secrets/
	)
})

test('Vercel candidate reaches READY and passes protected health verification before routing changes', () => {
	const commands = extractVercelCommands(workflow)
	const inspectCommand = commands.find(line =>
		line.startsWith('npx --yes "vercel@${VERCEL_CLI_VERSION}" inspect ')
	)
	const curlCommand = commands.find(line =>
		line.startsWith('npx --yes "vercel@${VERCEL_CLI_VERSION}" curl ')
	)

	assert.match(inspectCommand, /(?:^|\s)--wait(?:\s|$)/)
	assert.match(inspectCommand, /(?:^|\s)--timeout 10m(?:\s|$)/)
	assert.match(inspectCommand, /(?:^|\s)--format=json(?:\s|$)/)
	assert.match(curlCommand, /(?:^|\s)curl \/healthz(?:\s|$)/)
	assert.match(curlCommand, /(?:^|\s)--deployment "\$candidate_url"(?:\s|$)/)
	assert.match(workflow, /value\.readyState !== "READY"/)
	assert.match(workflow, /value\.target !== "production"/)
	assert.match(workflow, /value\.release !== process\.env\.RELEASE_SHA/)

	const readyCheck = workflow.indexOf('value.readyState !== "READY"')
	const healthCheck = workflow.indexOf(
		'value.release !== process.env.RELEASE_SHA'
	)
	const routeChange = workflow.indexOf(
		'node ops/release/edgeone-mode.mjs --mode all-vercel >/dev/null'
	)
	assert.ok(readyCheck >= 0 && readyCheck < routeChange)
	assert.ok(healthCheck >= 0 && healthCheck < routeChange)
	assert.doesNotMatch(
		workflow,
		/curl[^\n]*"https:\/\/\$CANDIDATE_URL\/healthz"/,
		'protected staged deployments must use vercel curl rather than unauthenticated curl'
	)
})

test('Vercel promotion waits for the production alias before Tencent activation', () => {
	const promote = workflow.indexOf('promote "$CANDIDATE_URL"')
	const polling = workflow.indexOf('for attempt in $(seq 1 12)')
	const releaseCheck = workflow.indexOf(
		'grep -qi "^x-letletme-release: $RELEASE_SHA"',
		polling
	)
	const activate = workflow.indexOf('letletme-release activate', releaseCheck)

	assert.ok(promote >= 0 && promote < polling)
	assert.ok(polling < releaseCheck && releaseCheck < activate)
	assert.match(workflow, /--max-time 5/)
	assert.match(workflow, /\[\[ \$attempt -eq 12 \]\] \|\| sleep 5/)
	assert.match(workflow, /\[\[ \$production_ready == 1 \]\]/)
})
