import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const FULL_GIT_SHA = /^[0-9a-f]{40}$/i

export function isDocumentationPath(file) {
	if (
		typeof file !== 'string' ||
		file.length === 0 ||
		file.startsWith('/') ||
		file.includes('\\') ||
		file.split('/').includes('..')
	) {
		return false
	}

	return (
		file.startsWith('docs/') ||
		(/^ops\/.+\.md$/i.test(file)) ||
		(!file.includes('/') && /\.md$/i.test(file))
	)
}

export function listGitChangedFiles(previousSha, currentSha, run = execFileSync) {
	for (const sha of [previousSha, currentSha]) {
		run('git', ['cat-file', '-e', `${sha}^{commit}`], {
			stdio: 'ignore'
		})
	}

	const output = run(
		'git',
		['diff', '--name-only', '--no-renames', previousSha, currentSha, '--'],
		{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
	)

	return String(output)
		.split('\n')
		.map(file => file.trim())
		.filter(Boolean)
}

function build(reason, files = []) {
	return { skip: false, reason, files }
}

function skip(reason, files) {
	return { skip: true, reason, files }
}

export function decideVercelBuild(
	env = process.env,
	changedFiles = listGitChangedFiles
) {
	if (env.LETLETME_FORCE_VERCEL_BUILD === '1') {
		return build('forced by LETLETME_FORCE_VERCEL_BUILD=1')
	}

	if (env.VERCEL_ENV !== 'production') {
		return build(`environment is ${env.VERCEL_ENV || 'unknown'}, not production`)
	}

	if (env.VERCEL_GIT_COMMIT_REF !== 'main') {
		return build(
			`Git ref is ${env.VERCEL_GIT_COMMIT_REF || 'unknown'}, not main`
		)
	}

	const previousSha = env.VERCEL_GIT_PREVIOUS_SHA
	const currentSha = env.VERCEL_GIT_COMMIT_SHA
	if (!FULL_GIT_SHA.test(previousSha || '') || !FULL_GIT_SHA.test(currentSha || '')) {
		return build('previous or current Vercel Git SHA is missing or invalid')
	}

	if (previousSha === currentSha) {
		return build('previous and current Vercel Git SHA are identical')
	}

	let files
	try {
		files = changedFiles(previousSha, currentSha)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		return build(`unable to read the full Git diff: ${message}`)
	}

	if (!Array.isArray(files) || files.length === 0) {
		return build('Git diff was empty or unavailable')
	}

	const runtimeFiles = files.filter(file => !isDocumentationPath(file))
	if (runtimeFiles.length > 0) {
		return build(`runtime-affecting files changed: ${runtimeFiles.join(', ')}`, files)
	}

	return skip(`all ${files.length} changed files are documentation`, files)
}

export function run() {
	const decision = decideVercelBuild()
	const action = decision.skip ? 'SKIP' : 'BUILD'
	console.log(`[vercel-ignore] ${action}: ${decision.reason}`)
	process.exitCode = decision.skip ? 0 : 1
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
	run()
}
