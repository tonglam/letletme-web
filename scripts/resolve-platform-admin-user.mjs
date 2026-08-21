import { pathToFileURL } from 'node:url'

import postgres from 'postgres'

export function parsePlatformAdminEntryId(value) {
	if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
		throw new Error('Provide one positive FPL entry ID')
	}
	const entryId = Number(value)
	if (!Number.isSafeInteger(entryId)) {
		throw new Error('FPL entry ID is outside the safe integer range')
	}
	return entryId
}

export async function resolvePlatformAdminUserId(entryId, databaseUrl) {
	if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
		throw new Error('DATABASE_URL is required')
	}

	const client = postgres(databaseUrl, { max: 1, prepare: false })
	try {
		const rows = await client`
			select id
			from bauth."user"
			where fpl_entry_id = ${entryId}
			  and fpl_entry_verified_at is not null
			order by id
			limit 2
		`
		if (rows.length !== 1 || typeof rows[0]?.id !== 'string' || !rows[0].id) {
			throw new Error(
				'Expected exactly one verified account for that FPL entry ID'
			)
		}
		return rows[0].id
	} finally {
		await client.end({ timeout: 5 })
	}
}

async function main() {
	const entryId = parsePlatformAdminEntryId(process.argv[2])
	const userId = await resolvePlatformAdminUserId(
		entryId,
		process.env.DATABASE_URL
	)
	process.stdout.write(`${userId}\n`)
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	main().catch(error => {
		console.error(error instanceof Error ? error.message : String(error))
		process.exitCode = 1
	})
}
