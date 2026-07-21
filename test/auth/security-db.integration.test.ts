import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import postgres from 'postgres'

const enabled = process.env.RUN_DB_INTEGRATION === 'true'

test('web security constraints serialize identity, session, and rate ownership', {
	skip: !enabled,
}, async () => {
	const databaseUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL
	assert.ok(databaseUrl, 'integration database URL is required')
	const sql = postgres(databaseUrl, { max: 8, prepare: false })
	const marker = randomUUID()
	const userIds = [`db-a-${marker}`, `db-b-${marker}`]
	const openid = `openid-${marker}`
	const scope = `integration-${marker}`

	try {
		const ownership = await Promise.allSettled(userIds.map((id, index) => sql`
			INSERT INTO bauth."user" (id, email, openid)
			VALUES (${id}, ${`db-${index}-${marker}@example.test`}, ${openid})
		`))
		assert.equal(ownership.filter((result) => result.status === 'fulfilled').length, 1)

		const [owner] = await sql<{ id: string }[]>`
			SELECT id FROM bauth."user" WHERE openid = ${openid}
		`
		assert.ok(owner)

		const sessions = await Promise.allSettled([0, 1].map((index) => sql`
			INSERT INTO bauth.mini_program_session
				(id, token_hash, user_id, device_id, expires_at)
			VALUES
				(${`session-${index}-${marker}`}, ${`token-${index}-${marker}`}, ${owner.id},
				 ${`device-${marker}`}, now() + interval '30 days')
		`))
		assert.equal(sessions.filter((result) => result.status === 'fulfilled').length, 1)

		await Promise.all(Array.from({ length: 10 }, () => sql`
			INSERT INTO bauth.request_rate_limits
				(scope, subject, bucket_start, window_seconds, count, expires_at)
			VALUES
				(${scope}, 'subject', date_trunc('minute', now()), 60, 1,
				 date_trunc('minute', now()) + interval '1 minute')
			ON CONFLICT (scope, subject, bucket_start)
			DO UPDATE SET count = bauth.request_rate_limits.count + 1
		`))
		const [counter] = await sql<{ count: number }[]>`
			SELECT count FROM bauth.request_rate_limits WHERE scope = ${scope}
		`
		assert.equal(counter?.count, 10)

		const [exposure] = await sql<{
			anon_schema: boolean
			anon_user: boolean
			anon_rate_limit: boolean
			authenticated_session: boolean
			policy_count: number
			missing_rls: number
		}[]>`
			SELECT
				has_schema_privilege('anon', 'bauth', 'USAGE') AS anon_schema,
				has_table_privilege('anon', 'bauth.user', 'SELECT') AS anon_user,
				has_table_privilege('anon', 'bauth.rate_limit', 'SELECT') AS anon_rate_limit,
				has_table_privilege('authenticated', 'bauth.session', 'SELECT') AS authenticated_session,
				(SELECT count(*)::int FROM pg_policies WHERE schemaname = 'bauth') AS policy_count,
				(SELECT count(*)::int
				 FROM pg_class relation
				 JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
				 WHERE namespace.nspname = 'bauth'
				   AND relation.relkind IN ('r', 'p')
				   AND NOT relation.relrowsecurity) AS missing_rls
		`
		assert.deepEqual(exposure, {
			anon_schema: false,
			anon_user: false,
			anon_rate_limit: false,
			authenticated_session: false,
			policy_count: 0,
			missing_rls: 0,
		})
	} finally {
		await sql`DELETE FROM bauth.request_rate_limits WHERE scope = ${scope}`
		await sql`DELETE FROM bauth."user" WHERE id IN ${sql(userIds)}`
		await sql.end()
	}
})
