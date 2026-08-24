import {
	pgSchema,
	text,
	boolean,
	timestamp,
	integer,
	uniqueIndex,
	unique,
	index,
	primaryKey,
	check,
	jsonb
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

const authSchema = pgSchema('bauth')

export const user = authSchema.table(
	'user',
	{
		id: text('id').primaryKey(),
		name: text('name'),
		email: text('email'),
		emailVerified: boolean('email_verified').notNull().default(false),
		image: text('image'),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		fplEntryId: integer('fpl_entry_id'),
		fplEntryBoundAt: timestamp('fpl_entry_bound_at', { withTimezone: true }),
		/** Matches production `bauth.user.openid` (WeChat / Mini Program identifier). */
		openid: text('openid'),
		fplEntryVerifiedAt: timestamp('fpl_entry_verified_at', {
			withTimezone: true
		}),
		/** Bind-time snapshot of the FPL team/manager name — display only. */
		fplTeamName: text('fpl_team_name'),
		fplManagerName: text('fpl_manager_name'),
		/** Last successful lazy re-sync of the name snapshot; gates the 24h refresh. */
		fplIdentityRefreshedAt: timestamp('fpl_identity_refreshed_at', {
			withTimezone: true
		})
	},
	table => ({
		emailUnique: unique('user_email_unique').on(table.email),
		openIdUnique: uniqueIndex('user_openid_unique')
			.on(table.openid)
			.where(sql`${table.openid} is not null`),
		verifiedFplEntryUnique: uniqueIndex('user_verified_fpl_entry_unique')
			.on(table.fplEntryId)
			.where(sql`${table.fplEntryVerifiedAt} is not null`)
	})
)

/**
 * Durable snapshots of FPL team names seen for a bound entry. The current
 * name remains on `user` for the fast display path; this table preserves the
 * previous names when FPL renames the entry.
 */
export const fplEntryNameHistory = authSchema.table(
	'fpl_entry_name_history',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		entryId: integer('entry_id').notNull(),
		teamName: text('team_name').notNull(),
		managerName: text('manager_name'),
		firstSeenAt: timestamp('first_seen_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
			.notNull()
			.defaultNow()
	},
	table => ({
		userEntryNameUnique: unique(
			'fpl_entry_name_history_user_entry_name_unique'
		).on(table.userId, table.entryId, table.teamName),
		userEntrySeenIdx: index('fpl_entry_name_history_user_entry_seen_idx').on(
			table.userId,
			table.entryId,
			table.lastSeenAt
		),
		teamNameNonempty: check(
			'fpl_entry_name_history_team_name_nonempty',
			sql`btrim(${table.teamName}) <> ''`
		)
	})
)

export const session = authSchema.table('session', {
	id: text('id').primaryKey(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	token: text('token').notNull().unique(),
	createdAt: timestamp('created_at', { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' })
})

/**
 * Append-only, privacy-preserving authentication telemetry. Raw identifiers
 * never enter this table: the runtime turns them into purpose-separated HMAC
 * references before the row is queued for insertion.
 */
export const authEvent = authSchema.table(
	'auth_event',
	{
		id: text('id').primaryKey(),
		occurredAt: timestamp('occurred_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		requestId: text('request_id').notNull(),
		eventType: text('event_type').notNull(),
		channel: text('channel').notNull(),
		operation: text('operation').notNull(),
		outcome: text('outcome').notNull(),
		statusCode: integer('status_code'),
		errorCode: text('error_code'),
		phaseTimings: jsonb('phase_timings').$type<Record<string, number> | null>(),
		webUserRef: text('web_user_ref'),
		miniAccountRef: text('mini_account_ref'),
		emailRef: text('email_ref'),
		sessionRef: text('session_ref'),
		deviceRef: text('device_ref'),
		ipRef: text('ip_ref'),
		trigger: text('trigger'),
		revokedSessionCount: integer('revoked_session_count'),
		clientPlatform: text('client_platform'),
		clientDeviceClass: text('client_device_class'),
		clientOsFamily: text('client_os_family'),
		clientOsMajor: text('client_os_major'),
		clientBrowserFamily: text('client_browser_family'),
		clientBrowserMajor: text('client_browser_major'),
		wechatMajor: text('wechat_major'),
		sdkVersion: text('sdk_version'),
		miniProgramVersion: text('mini_program_version'),
		envVersion: text('env_version'),
		pageRoute: text('page_route'),
		encryptedStorageSupported: boolean('encrypted_storage_supported'),
		credentialState: text('credential_state'),
		release: text('release'),
		source: text('source'),
		region: text('region')
	},
	table => ({
		expiresIdx: index('auth_event_expires_idx').on(table.expiresAt),
		requestIdx: index('auth_event_request_idx').on(table.requestId),
		sessionIdx: index('auth_event_session_idx').on(table.sessionRef),
		webUserIdx: index('auth_event_web_user_idx').on(table.webUserRef),
		miniAccountIdx: index('auth_event_mini_account_idx').on(
			table.miniAccountRef
		),
		deviceIdx: index('auth_event_device_idx').on(table.deviceRef),
		occurredIdx: index('auth_event_occurred_idx').on(table.occurredAt),
		expiryWindow: check(
			'auth_event_expiry_window_check',
			sql`${table.expiresAt} >= ${table.occurredAt} AND ${table.expiresAt} <= ${table.occurredAt} + INTERVAL '45 days'`
		)
	})
)

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
	accessTokenExpiresAt: timestamp('access_token_expires_at', {
		withTimezone: true
	}),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
		withTimezone: true
	}),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('created_at', { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
})

export const verification = authSchema.table('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
})

export const miniProgramEmailCode = authSchema.table(
	'mini_program_email_code',
	{
		id: text('id').primaryKey(),
		email: text('email').notNull(),
		deviceId: text('device_id').notNull(),
		codeHash: text('code_hash').notNull(),
		attempts: integer('attempts').notNull().default(0),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		consumedAt: timestamp('consumed_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow()
	},
	table => ({
		pendingUnique: uniqueIndex('mini_program_email_code_pending_unique')
			.on(table.email, table.deviceId)
			.where(sql`${table.consumedAt} is null`)
	})
)

export const miniProgramAccount = authSchema.table(
	'mini_program_account',
	{
		id: text('id').primaryKey(),
		openid: text('openid').notNull(),
		unionid: text('unionid'),
		linkedWebUserId: text('linked_web_user_id').references(() => user.id, {
			onDelete: 'set null'
		}),
		linkedAt: timestamp('linked_at', { withTimezone: true }),
		followEntryId: integer('follow_entry_id'),
		entryChoice: text('entry_choice'),
		entryChoiceMiniEntryId: integer('entry_choice_mini_entry_id'),
		entryChoiceWebEntryId: integer('entry_choice_web_entry_id'),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
	},
	table => ({
		openIdUnique: unique('mini_program_account_openid_unique').on(table.openid),
		unionIdUnique: uniqueIndex('mini_program_account_unionid_unique')
			.on(table.unionid)
			.where(sql`${table.unionid} is not null`),
		linkedWebUserUnique: uniqueIndex(
			'mini_program_account_linked_web_user_unique'
		)
			.on(table.linkedWebUserId)
			.where(sql`${table.linkedWebUserId} is not null`),
		followEntryPositive: check(
			'mini_program_account_follow_entry_positive',
			sql`${table.followEntryId} is null or ${table.followEntryId} > 0`
		),
		entryChoiceValid: check(
			'mini_program_account_entry_choice_valid',
			sql`${table.entryChoice} is null or ${table.entryChoice} in ('MINI', 'WEB')`
		),
		entryChoicePairValid: check(
			'mini_program_account_entry_choice_pair_valid',
			sql`(${table.entryChoice} is null and ${table.entryChoiceMiniEntryId} is null and ${table.entryChoiceWebEntryId} is null) or (${table.entryChoice} is not null and ${table.entryChoiceMiniEntryId} > 0 and ${table.entryChoiceWebEntryId} > 0 and ${table.entryChoiceMiniEntryId} <> ${table.entryChoiceWebEntryId})`
		)
	})
)

export const miniProgramSession = authSchema.table(
	'mini_program_session',
	{
		id: text('id').primaryKey(),
		tokenHash: text('token_hash').notNull(),
		userId: text('user_id').references(() => user.id, {
			onDelete: 'set null'
		}),
		deviceId: text('device_id').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		lastUsedAt: timestamp('last_used_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		revokedAt: timestamp('revoked_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		accountId: text('account_id').references(() => miniProgramAccount.id, {
			onDelete: 'cascade'
		})
	},
	table => ({
		tokenHashIdx: uniqueIndex('mini_program_session_token_hash_idx').on(
			table.tokenHash
		),
		activeUserDeviceUnique: uniqueIndex(
			'mini_program_session_active_user_device_unique'
		)
			.on(table.userId, table.deviceId)
			.where(sql`${table.revokedAt} is null and ${table.userId} is not null`),
		activeAccountDeviceUnique: uniqueIndex(
			'mini_program_session_active_account_device_unique'
		)
			.on(table.accountId, table.deviceId)
			.where(sql`${table.revokedAt} is null and ${table.accountId} is not null`),
		principalPresent: check(
			'mini_program_session_principal_present',
			sql`${table.userId} is not null or ${table.accountId} is not null`
		)
	})
)

export const requestRateLimit = authSchema.table(
	'request_rate_limits',
	{
		scope: text('scope').notNull(),
		subject: text('subject').notNull(),
		bucketStart: timestamp('bucket_start', { withTimezone: true }).notNull(),
		windowSeconds: integer('window_seconds').notNull(),
		count: integer('count').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
	},
	table => ({
		pk: primaryKey({
			name: 'request_rate_limits_pk',
			columns: [table.scope, table.subject, table.bucketStart]
		}),
		expiresIdx: index('request_rate_limits_expires_idx').on(table.expiresAt),
		windowSecondsPositive: check(
			'request_rate_limits_window_seconds_check',
			sql`${table.windowSeconds} > 0`
		),
		countPositive: check(
			'request_rate_limits_count_check',
			sql`${table.count} > 0`
		)
	})
)

export const fplEntryBindingChallenge = authSchema.table(
	'fpl_entry_binding_challenges',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		entryId: integer('entry_id').notNull(),
		requiredName: text('required_name').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		attempts: integer('attempts').notNull().default(0),
		consumedAt: timestamp('consumed_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
	},
	table => ({
		userCreatedIdx: index('fpl_entry_binding_challenges_user_created_idx').on(
			table.userId,
			table.createdAt
		),
		pendingIdx: index('fpl_entry_binding_challenges_pending_idx')
			.on(table.userId, table.expiresAt)
			.where(sql`${table.consumedAt} is null`)
	})
)

/**
 * One-time replay protection for signed internal storage operations.
 *
 * The table lives in the Web-owned auth schema so every Next.js instance
 * shares the same nonce ledger; an in-process cache alone would allow a
 * captured cleanup request to be replayed on another instance.
 */
export const bugReportStorageNonce = authSchema.table(
	'bug_report_storage_nonces',
	{
		nonce: text('nonce').primaryKey(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow()
	},
	table => ({
		expiresIdx: index('bug_report_storage_nonces_expires_idx').on(
			table.expiresAt
		),
		nonceNonempty: check(
			'bug_report_storage_nonces_nonce_nonempty',
			sql`btrim(nonce) <> ''`
		)
	})
)
