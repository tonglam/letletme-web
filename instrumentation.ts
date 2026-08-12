type DatabaseContractValidator = () => Promise<unknown>
type ContractFailureWriter = (message: string) => void

function isWebDatabaseContractViolation(error: unknown): boolean {
	return (
		error instanceof Error &&
		error.name === 'WebDatabaseContractError' &&
		Array.isArray((error as Error & { findings?: unknown }).findings)
	)
}

export async function auditWebDatabaseContract(
	validate: DatabaseContractValidator = async () => {
		const { validateWebDatabaseContract } = await import('./lib/db/runtime-contract')
		return validateWebDatabaseContract(undefined, { connectTimeoutSeconds: 2 })
	},
	writeFailure: ContractFailureWriter = message => {
		console.error(message.trimEnd())
	},
): Promise<void> {
	try {
		await validate()
	} catch (error) {
		if (isWebDatabaseContractViolation(error)) throw error
		const message = error instanceof Error ? error.message : 'unknown database contract error'
		writeFailure(`[web-database-contract] transient startup audit failed: ${message}\n`)
	}
}

export async function register() {
	if (process.env.NEXT_RUNTIME === 'nodejs') {
		// Next keeps register() inside the managed server-start lifecycle. Real
		// privilege findings still reject startup; bounded connectivity failures are
		// logged and degraded so a temporary pooler delay cannot turn Home into 500.
		await auditWebDatabaseContract()
	}
}
