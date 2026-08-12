import {
	assertWebRuntimeDatabaseTarget,
	assertWebRuntimeDatabaseUrl,
	bootstrapWebRuntimeLogin,
	parseWebRuntimeBootstrapArgs,
	requiredEnvironment,
	verifyWebRuntimeConnectionWithRetry,
	verifyWebRuntimeLogin,
	WEB_RUNTIME_LOGIN
} from './runtime-login-contract'
import { validateWebDatabaseContract } from '../lib/db/runtime-contract'
import { pathToFileURL } from 'node:url'

async function main(): Promise<void> {
	parseWebRuntimeBootstrapArgs(process.argv.slice(2))
	const directDatabaseUrl = requiredEnvironment('DIRECT_DATABASE_URL')
	const runtimeDatabaseUrl = requiredEnvironment('WEB_RUNTIME_DATABASE_URL')
	const { password } = assertWebRuntimeDatabaseUrl(runtimeDatabaseUrl)
	assertWebRuntimeDatabaseTarget(directDatabaseUrl, runtimeDatabaseUrl)

	const credentialMutated = await bootstrapWebRuntimeLogin(
		directDatabaseUrl,
		password
	)
	const structuralContract = await verifyWebRuntimeLogin(directDatabaseUrl)
	const loginContract = await verifyWebRuntimeConnectionWithRetry(
		() =>
			validateWebDatabaseContract(runtimeDatabaseUrl, {
				connectTimeoutSeconds: 5,
				statementTimeoutMilliseconds: 5_000,
				auditTimeoutMilliseconds: 15_000
			}),
		{ retryAuthentication: credentialMutated }
	)

	console.log(
		JSON.stringify(
			{
				operation: 'bootstrap-web-runtime-login',
				runtimeLogin: WEB_RUNTIME_LOGIN,
				credentialMutated,
				runtimeConnectionVerified: true,
				outcome: credentialMutated ? 'created' : 'verified-existing',
				structuralContract,
				loginContract
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
		console.error('[bootstrap-runtime-login] failed', error)
		process.exitCode = 1
	})
}
