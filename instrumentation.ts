type DatabaseContractValidator = () => Promise<unknown>
type ContractFailureWriter = (message: string) => void

const TRANSIENT_DATABASE_ERROR_CODES = new Set([
	'08001',
	'08006',
	'53300',
	'57014',
	'57P01',
	'57P02',
	'57P03',
	'EAI_AGAIN',
	'ECIRCUITBREAKER',
	'ECONNABORTED',
	'ECONNREFUSED',
	'ECONNRESET',
	'EHOSTDOWN',
	'EHOSTUNREACH',
	'ENETDOWN',
	'ENETRESET',
	'ENETUNREACH',
	'EPIPE',
	'ETIMEDOUT'
])

function isWebDatabaseContractViolation(error: unknown): boolean {
	return (
		error instanceof Error &&
		error.name === 'WebDatabaseContractError' &&
		Array.isArray((error as Error & { findings?: unknown }).findings)
	)
}

function isTransientWebDatabaseAuditFailure(error: unknown): boolean {
	if (!(error instanceof Error)) return false
	if (error.name === 'WebDatabaseContractAuditTimeoutError') return true

	const code = (error as Error & { code?: unknown }).code
	if (typeof code === 'string' && TRANSIENT_DATABASE_ERROR_CODES.has(code)) {
		return true
	}

	return /\b(?:CONNECT_TIMEOUT|ECIRCUITBREAKER)\b/.test(error.message)
}

export async function auditWebDatabaseContract(
	validate: DatabaseContractValidator = async () => {
		const { validateWebDatabaseContract } = await import('./lib/db/runtime-contract')
		return validateWebDatabaseContract(undefined, {
			connectTimeoutSeconds: 2,
			statementTimeoutMilliseconds: 1_500,
			auditTimeoutMilliseconds: 2_000,
		})
	},
	writeFailure: ContractFailureWriter = message => {
		console.error(message.trimEnd())
	},
): Promise<void> {
	try {
		await validate()
	} catch (error) {
		if (isWebDatabaseContractViolation(error)) throw error
		if (!isTransientWebDatabaseAuditFailure(error)) throw error
		const message = error instanceof Error ? error.message : 'unknown database contract error'
		writeFailure(`[web-database-contract] transient startup audit failed: ${message}\n`)
	}
}

export async function register() {
	if (process.env.NEXT_RUNTIME === 'nodejs') {
		// Next keeps register() inside the managed server-start lifecycle. Real
		// privilege findings still reject startup; the complete audit has a hard
		// deadline so a temporary pooler delay cannot turn Home into 500.
		await auditWebDatabaseContract()
	}
}
