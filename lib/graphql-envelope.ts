import { createHmac } from 'crypto'
import { isPlatformAdminIdentity } from '@/lib/platform-admin'

export type GraphQLIdentity = {
	id: string
	fplEntryId?: number | null
	fplEntryVerifiedAt?: Date | string | null
}

export function buildGraphQLUserContextHeaders(
	user: GraphQLIdentity,
	secret: string,
	nowSeconds = Math.floor(Date.now() / 1000),
	platformAdminEntryConfig = process.env.PLATFORM_ADMIN_FPL_ENTRY_IDS,
	platformAdminUserConfig = process.env.PLATFORM_ADMIN_USER_IDS
): Record<string, string> {
	const verifiedAtCandidate = user.fplEntryVerifiedAt
		? new Date(user.fplEntryVerifiedAt)
		: null
	const verifiedAt =
		verifiedAtCandidate && Number.isFinite(verifiedAtCandidate.getTime())
			? verifiedAtCandidate.toISOString()
			: null
	const entryId =
		verifiedAt &&
		typeof user.fplEntryId === 'number' &&
		Number.isSafeInteger(user.fplEntryId) &&
		user.fplEntryId > 0
			? user.fplEntryId
			: null
	const envelope = {
		aud: 'letletme-graphql',
		uid: user.id,
		eid: entryId,
		evat: verifiedAt,
		// The role is server-managed and covered by the same short-lived HMAC as
		// the verified FPL binding. Never infer it from a browser payload.
		adm:
			entryId !== null &&
			isPlatformAdminIdentity(
				user,
				platformAdminEntryConfig,
				platformAdminUserConfig
			),
		iat: nowSeconds,
		exp: nowSeconds + 60
	}
	const payload = JSON.stringify(envelope)
	const signature = createHmac('sha256', secret)
		.update(payload)
		.digest('base64url')
	return {
		'X-User-Context': Buffer.from(payload).toString('base64url'),
		'X-User-Context-Sig': signature
	}
}
