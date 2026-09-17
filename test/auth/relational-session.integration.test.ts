import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import test from 'node:test'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../lib/db/schema/auth'

const runtimeUrl = process.env.E2E_DATABASE_URL
const directUrl = process.env.E2E_DIRECT_DATABASE_URL

test('relational auth reads preserve fresh identity and rejection boundaries', {
	skip: !runtimeUrl || !directUrl
}, async () => {
	for (const value of [runtimeUrl!, directUrl!]) {
		const url = new URL(value)
		assert.ok(['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname))
		assert.match(url.pathname, /^\/(?:testdb|[a-zA-Z0-9_]+_e2e)$/)
	}
	const runtimeTarget = new URL(runtimeUrl!)
	const fixtureTarget = new URL(directUrl!)
	assert.equal(runtimeTarget.host, fixtureTarget.host)
	assert.equal(runtimeTarget.pathname, fixtureTarget.pathname)
	assert.equal(new URL(runtimeUrl!).username, 'letletme_web_runtime')
	const runtime = postgres(runtimeUrl!, { max: 1, prepare: false, fetch_types: false })
	const fixture = postgres(directUrl!, { max: 1, prepare: false, fetch_types: false })
	const id = `relational-test-${randomUUID()}`
	const token = randomUUID()
	const secret = randomUUID() + randomUUID()
	const email = `${id}@example.invalid`
	const headers = new Headers({ cookie: `relational.session_token=${encodeURIComponent(
		token + '.' + createHmac('sha256', secret).update(token).digest('base64')
	)}` })
	let selects = 0
	const db = drizzle(runtime, { schema, logger: { logQuery(query) {
		if (/^select\b/i.test(query)) selects++
	} } })
	try {
		await fixture`insert into bauth."user" (id,name,email,email_verified) values (${id},'Test',${email},true)`
		await fixture`insert into bauth.account (id,account_id,provider_id,user_id) values (${id},${id},'test',${id})`
		for (const joins of [false, true]) {
			const auth = betterAuth({
				baseURL: 'http://localhost:3217', secret, experimental: { joins },
				database: drizzleAdapter(db, { provider: 'pg', schema }),
				advanced: { cookiePrefix: 'relational' },
				session: { cookieCache: { enabled: false } },
				user: { additionalFields: {
					fplEntryId: { type: 'number', required: false, input: false },
					fplEntryBoundAt: { type: 'date', required: false, input: false },
					fplEntryVerifiedAt: { type: 'date', required: false, input: false },
					fplTeamName: { type: 'string', required: false, input: false },
					fplManagerName: { type: 'string', required: false, input: false }
				} }
			})
			const context = await auth.$context
			const query = { disableCookieCache: true }
			await fixture`insert into bauth.session(id,token,user_id,expires_at) values(${id},${token},${id},${new Date(Date.now() + 7 * 86400000)})`
			selects = 0
			const valid = await auth.api.getSession({ headers, query })
			assert.equal(valid?.session.id, id)
			assert.equal(valid?.user.id, id)
			assert.equal(selects, joins ? 1 : 2)
			const boundAt = new Date('2026-09-01T00:00:00Z')
			await fixture`update bauth."user" set fpl_entry_id=991308,fpl_entry_bound_at=${boundAt},fpl_entry_verified_at=${boundAt},fpl_team_name='Team',fpl_manager_name='Manager' where id=${id}`
			const bound = await auth.api.getSession({ headers, query })
			assert.equal(bound?.user.fplEntryId, 991308)
			assert.equal(bound?.user.fplEntryBoundAt?.toISOString(), boundAt.toISOString())
			assert.equal(bound?.user.fplEntryVerifiedAt?.toISOString(), boundAt.toISOString())
			assert.equal(bound?.user.fplTeamName, 'Team')
			assert.equal(bound?.user.fplManagerName, 'Manager')
			await fixture`update bauth."user" set fpl_entry_id=991309,fpl_entry_verified_at=null where id=${id}`
			const changed = await auth.api.getSession({ headers, query })
			assert.equal(changed?.user.fplEntryId, 991309)
			assert.equal(changed?.user.fplEntryVerifiedAt, null)
			const sessions = await context.internalAdapter.findSessions([token], { onlyActiveSessions: true })
			assert.equal(sessions.length, 1)
			assert.equal(sessions[0].user.id, id)
			selects = 0
			const oauth = await context.internalAdapter.findOAuthUser(email, id, 'test')
			assert.equal(oauth?.user.id, id)
			assert.equal(oauth?.linkedAccount?.id, id)
			assert.equal(selects, joins ? 1 : 2)
			selects = 0
			const found = await context.internalAdapter.findUserByEmail(email, { includeAccounts: true })
			assert.equal(found?.accounts.length, 1)
			assert.equal(found?.accounts[0].id, id)
			assert.equal(selects, joins ? 1 : 2)
			await fixture`update bauth.session set expires_at=${new Date(Date.now() - 60000)} where id=${id}`
			assert.equal(await auth.api.getSession({ headers, query }), null)
			await fixture`delete from bauth.session where id=${id}`
			assert.equal(await auth.api.getSession({ headers, query }), null)
		}
	} finally {
		try {
			await fixture`delete from bauth.session where id=${id}`
			await fixture`delete from bauth.account where id=${id}`
			await fixture`delete from bauth."user" where id=${id}`
		} finally { await Promise.all([runtime.end(), fixture.end()]) }
	}
})
