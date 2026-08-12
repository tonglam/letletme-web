import {
	requiredEnvironment,
	verifyWebRuntimeLogin
} from './runtime-login-contract'
import { pathToFileURL } from 'node:url'

async function main(): Promise<void> {
	const args = process.argv.slice(2)
	if (args.length > 0) {
		throw new Error(
			`Web runtime LOGIN verification does not accept arguments: ${args.join(' ')}`
		)
	}
	const directDatabaseUrl = requiredEnvironment('DIRECT_DATABASE_URL')
	const contract = await verifyWebRuntimeLogin(directDatabaseUrl)
	console.log(
		JSON.stringify(
			{
				operation: 'verify-web-runtime-login',
				credentialMutated: false,
				contract
			},
			null,
			2
		)
	)
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	main().catch(error => {
		console.error('[verify-runtime-login] failed', error)
		process.exitCode = 1
	})
}
