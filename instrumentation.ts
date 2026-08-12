type DatabaseContractValidator = () => Promise<unknown>
type ContractFailureWriter = (message: string) => void

export async function auditWebDatabaseContract(
	validate: DatabaseContractValidator = async () => {
		const { validateWebDatabaseContract } = await import('./lib/db/runtime-contract')
		return validateWebDatabaseContract()
	},
	writeFailure: ContractFailureWriter = message => {
		console.error(message.trimEnd())
	},
): Promise<void> {
	try {
		await validate()
	} catch (error) {
		const message = error instanceof Error ? error.message : 'unknown database contract error'
		writeFailure(`[web-database-contract] background audit failed: ${message}\n`)
	}
}

export function register() {
	if (process.env.NEXT_RUNTIME === 'nodejs') {
		// A full cross-schema privilege audit is observability, not a prerequisite
		// for serving the public shell. Awaiting it here turns a transient database
		// or cross-region timeout into a cold-start 500 for every route.
		void auditWebDatabaseContract()
	}
}
