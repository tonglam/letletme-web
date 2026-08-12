import 'server-only'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { resolveWebDatabasePoolMax } from './pool-config'
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
