export async function register() {
	if (process.env.NEXT_RUNTIME === 'nodejs') {
		try {
			const { validateWebDatabaseContract } = await import('./lib/db/runtime-contract')
			await validateWebDatabaseContract()
		} catch (error) {
			const message = error instanceof Error ? error.message : 'unknown database contract error'
			process.stderr.write(`[web-database-contract] startup rejected: ${message}\n`)
			process.exit(1)
		}
	}
}
