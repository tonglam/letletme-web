import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

// Keep this list aligned with the build-time configuration used by Tencent.
// Runtime credentials must never enter the CI configuration response.
const publicKeys = [
	'BETTER_AUTH_URL',
	'NEXT_PUBLIC_APP_URL',
	'NEXT_PUBLIC_SUPABASE_URL',
	'NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE'
]

export function readBuildConfig(env) {
	const key = env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
	if (typeof key !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(key)) {
		throw new Error('Server Actions build key must be canonical 32-byte base64')
	}
	const decoded = Buffer.from(key, 'base64')
	if (decoded.length !== 32 || decoded.toString('base64') !== key) {
		throw new Error('Server Actions build key must be canonical 32-byte base64')
	}
	const publicEnvironment = {}
	for (const name of publicKeys) {
		if (env[name] !== undefined && env[name] !== '') {
			if (name.endsWith('_URL')) {
				const url = new URL(env[name])
				if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
					throw new Error(`Unsafe public build URL: ${name}`)
				}
			}
			publicEnvironment[name] = env[name]
		}
	}
	return {
		publicEnvironment,
		serverActionsKeySha256: createHash('sha256').update(decoded).digest('hex')
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		process.stdout.write(`${JSON.stringify(readBuildConfig(process.env))}\n`)
	} catch {
		// Never echo a malformed configuration value (it could contain a secret).
		process.stderr.write('Invalid Tencent build configuration\n')
		process.exitCode = 1
	}
}
