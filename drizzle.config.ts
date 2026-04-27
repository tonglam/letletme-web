import { defineConfig } from 'drizzle-kit'

// Prefer the direct (non-pooled) URL for migrations; fall back to DATABASE_URL
const databaseUrl =
	process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL

if (!databaseUrl) {
	throw new Error('DATABASE_URL is required to run drizzle-kit')
}

export default defineConfig({
	dialect: 'postgresql',
	schema: './lib/db/schema/auth.ts',
	out: './drizzle',
	schemaFilter: ['bauth'],
	dbCredentials: { url: databaseUrl },
	strict: true,
	verbose: true,
})
