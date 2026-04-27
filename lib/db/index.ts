import 'server-only'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as authSchema from './schema/auth'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
	throw new Error('DATABASE_URL is not set')
}

const client = postgres(connectionString, {
	max: Number(process.env.DATABASE_POOL_MAX ?? 10),
	prepare: false,
})

export const db = drizzle(client, { schema: { ...authSchema } })

export const schema = { ...authSchema }
