import 'server-only'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import {
	resolveWebDatabasePoolMax,
	WEB_DATABASE_IDLE_TRANSACTION_TIMEOUT_MS,
	WEB_DATABASE_LOCK_TIMEOUT_MS,
	WEB_DATABASE_STATEMENT_TIMEOUT_MS
} from './pool-config'
import * as authSchema from './schema/auth'

let _db: ReturnType<typeof drizzle> | null = null

function getDb() {
	if (_db) return _db

	const connectionString = process.env.DATABASE_URL
	if (!connectionString) {
		throw new Error('DATABASE_URL is not set')
	}

	const client = postgres(connectionString, {
		// Vercel instances share one bounded Supavisor runtime login. Keep each
		// lazy pool small and release idle sessions instead of hoarding the login.
		max: resolveWebDatabasePoolMax(),
		idle_timeout: 20,
		connect_timeout: 5,
		prepare: false,
		// Better Auth uses this bounded runtime login for every adapter call.
		// Enforce cancellation at PostgreSQL as well as at the request boundary;
		// an outer Promise timeout alone would leave the query occupying a slot.
		connection: {
			statement_timeout: WEB_DATABASE_STATEMENT_TIMEOUT_MS,
			lock_timeout: WEB_DATABASE_LOCK_TIMEOUT_MS,
			idle_in_transaction_session_timeout:
				WEB_DATABASE_IDLE_TRANSACTION_TIMEOUT_MS
		},
		// The application schema uses scalar/JSON columns only. Avoid a type-catalog
		// round trip on each new connection; the array-based role auditor uses its own client.
		fetch_types: false,
	})

	_db = drizzle(client, { schema: { ...authSchema } })
	return _db
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
	get(_, prop) {
		return Reflect.get(getDb(), prop)
	},
})

export const schema = { ...authSchema }
