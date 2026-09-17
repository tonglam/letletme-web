// Loaded only by Playwright's isolated standalone server, never by production builds.
const database = new URL(process.env.E2E_DATABASE_URL ?? 'invalid:')
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(database.hostname)) {
	throw new Error('FPL fixture requires an isolated loopback E2E database')
}
const originalFetch = globalThis.fetch.bind(globalThis)
globalThis.fetch = async (input, init) => {
	const url = new URL(input instanceof Request ? input.url : String(input))
	if (url.hostname !== 'fantasy.premierleague.com') return originalFetch(input, init)
	const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
	const match = /^\/api\/entry\/(\d+)\/$/.exec(url.pathname)
	if (url.protocol !== 'https:' || method !== 'GET' || !match || url.search) {
		throw new Error('Unexpected FPL request in isolated fixture')
	}
	const id = Number(match[1])
	if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid fixture entry ID')
	return Response.json({ id, name: 'E2E Synced United', player_first_name: 'Fixture', player_last_name: 'Manager' })
}
