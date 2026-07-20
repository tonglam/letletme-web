import { createHmac } from 'crypto'

export type GraphQLIdentity = {
	id: string
	fplEntryId?: number | null
	fplEntryVerifiedAt?: Date | string | null
}

export function buildGraphQLUserContextHeaders(
	user: GraphQLIdentity,
	secret: string,
	nowSeconds = Math.floor(Date.now() / 1000)
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
		v: 2,
		aud: 'letletme-graphql',
		uid: user.id,
		eid: entryId,
		evat: verifiedAt,
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
