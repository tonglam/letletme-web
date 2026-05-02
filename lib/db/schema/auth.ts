import { pgSchema, text, boolean, timestamp, integer, uniqueIndex, index } from 'drizzle-orm/pg-core'

const authSchema = pgSchema('bauth')

export const user = authSchema.table(
	'user',
	{
		id: text('id').primaryKey(),
		name: text('name'),
		email: text('email'),
		emailVerified: boolean('email_verified').notNull().default(false),
		image: text('image'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		fplEntryId: integer('fpl_entry_id'),
		fplEntryBoundAt: timestamp('fpl_entry_bound_at', { withTimezone: true }),
		/** Matches production `bauth.user.openid` (WeChat / Mini Program identifier). */
		openid: text('openid'),
	},
	table => ({
		emailUnique: uniqueIndex('user_email_unique').on(table.email),
		openIdIdx: index('idx_bauth_user_openid').on(table.openid),
	}),
)

export const session = authSchema.table('session', {
	id: text('id').primaryKey(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	token: text('token').notNull().unique(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
})

export const account = authSchema.table('account', {
	id: text('id').primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const verification = authSchema.table('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// JWT plugin table
export const jwks = authSchema.table('jwks', {
	id: text('id').primaryKey(),
	publicKey: text('public_key').notNull(),
	privateKey: text('private_key').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Only present after `0001_miniprogram_account.sql` is applied — enable with `MINIPROGRAM_ACCOUNT_STORAGE=true`. */
export const miniProgramEmailCode = authSchema.table('mini_program_email_code', {
	id: text('id').primaryKey(),
	email: text('email').notNull(),
	deviceId: text('device_id').notNull(),
	codeHash: text('code_hash').notNull(),
	attempts: integer('attempts').notNull().default(0),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	consumedAt: timestamp('consumed_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Only present after `0001_miniprogram_account.sql` is applied — enable with `MINIPROGRAM_ACCOUNT_STORAGE=true`. */
export const miniProgramSession = authSchema.table(
	'mini_program_session',
	{
		id: text('id').primaryKey(),
		tokenHash: text('token_hash').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		deviceId: text('device_id').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
		revokedAt: timestamp('revoked_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	table => ({
		tokenHashIdx: uniqueIndex('mini_program_session_token_hash_idx').on(table.tokenHash),
	}),
)
