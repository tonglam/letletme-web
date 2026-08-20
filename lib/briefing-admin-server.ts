import 'server-only'

type ContentCommandRole = 'editor' | 'publisher'
type ContentCommandOptions = { idempotencyKey: string; actorId: string }

type ContentCommandResponse<T> = {
	success: boolean
	data?: T
	error?: string
}

const dataBaseUrl = () =>
	(process.env.LETLETME_DATA_URL ?? '').trim().replace(/\/$/, '')

const keyForRole = (role: ContentCommandRole) =>
	(role === 'publisher'
		? process.env.LETLETME_CONTENT_PUBLISHER_API_KEY
		: process.env.LETLETME_CONTENT_EDITOR_API_KEY
	)?.trim() ?? ''

async function contentCommand<T>(
	path: string,
	role: ContentCommandRole,
	body: unknown,
	options: ContentCommandOptions
): Promise<T> {
	const baseUrl = dataBaseUrl()
	const apiKey = keyForRole(role)
	if (!baseUrl || !apiKey)
		throw new Error(`Briefing ${role} command is not configured`)
	if (!options.idempotencyKey.trim() || !options.actorId.trim())
		throw new Error('Stable Idempotency-Key and actorId are required')
	const response = await fetch(`${baseUrl}${path}`, {
		method: 'POST',
		cache: 'no-store',
		headers: {
			'content-type': 'application/json',
			'x-api-key': apiKey,
			'idempotency-key': options.idempotencyKey,
			'x-actor-id': options.actorId
		},
		body: JSON.stringify(body)
	})
	const result = (await response
		.json()
		.catch(() => null)) as ContentCommandResponse<T> | null
	if (!response.ok || !result?.success) {
		throw new Error(
			result?.error ?? `Content command failed (${response.status})`
		)
	}
	return result.data as T
}

export function upsertBriefingSourceGroup(input: {
	groupKey: string
	displayName: string
	pollPolicy?: Record<string, unknown>
	},
	options: ContentCommandOptions) {
	return contentCommand<{ groupId: string }>(
		'/content/sources/groups',
		'editor',
		input,
		options
	)
}

export function upsertBriefingSource(input: {
	platform: string
	externalId: string
	handle?: string | null
	displayName: string
	sourceType: string
	reportingFamily: string
	rightsPolicy?: Record<string, unknown>
	},
	options: ContentCommandOptions) {
	return contentCommand<{ sourceId: string }>(
		'/content/sources',
		'editor',
		input,
		options
	)
}

export function attachBriefingSource(
	groupKey: string,
	sourceId: string,
	options: ContentCommandOptions
) {
	return contentCommand<{ success: true }>(
		`/content/sources/groups/${encodeURIComponent(groupKey)}/members/${encodeURIComponent(sourceId)}`,
		'editor',
		{},
		options
	)
}

export function createBriefingCandidate(
	input: {
		runId: string
		canonicalHash: string
		materiality?: string
		receiptIds: string[]
	},
	options: ContentCommandOptions
) {
	return contentCommand<{ candidateId: string }>(
		'/content/editorial/candidates',
		'editor',
		input,
		options
	)
}

export function acceptBriefingCandidate(
	candidateId: string,
	options: ContentCommandOptions
) {
	return contentCommand<void>(
		`/content/editorial/candidates/${encodeURIComponent(candidateId)}/accept`,
		'editor',
		{},
		options
	)
}

export function mergeBriefingCandidates(
	targetCandidateId: string,
	sourceCandidateIds: string[],
	options: ContentCommandOptions
) {
	return contentCommand<void>(
		`/content/editorial/candidates/${encodeURIComponent(targetCandidateId)}/merge`,
		'editor',
		{ sourceCandidateIds },
		options
	)
}

export function createBriefingStory(
	input: {
		candidateId: string
		slug: string
		expiresAt?: string | null
		localizations: Array<{
			locale: 'en' | 'zh-CN'
			title: string
			summary: string
			body: string
			sourceAttribution?: string | null
			claims?: string[]
		}>
	},
	options: ContentCommandOptions
) {
	return contentCommand<{ storyId: string }>(
		'/content/editorial/stories',
		'editor',
		input,
		options
	)
}

export function attachBriefingStoryEvidence(
	storyId: string,
	receiptIds: string[],
	options: ContentCommandOptions
) {
	return contentCommand<{ inserted: number }>(
		`/content/editorial/stories/${encodeURIComponent(storyId)}/evidence`,
		'editor',
		{ receiptIds },
		options
	)
}

export function markBriefingStoryReady(
	storyId: string,
	options: ContentCommandOptions
) {
	return contentCommand<void>(
		`/content/editorial/stories/${encodeURIComponent(storyId)}/ready`,
		'editor',
		{},
		options
	)
}

export function createBriefingWeekEdition(
	input: {
		seasonCode: string
		eventId: number
		eventName: string
		deadlineTime: string
		sourceSnapshotRevision: string
		sourceRunIds: string[]
	},
	options: ContentCommandOptions
) {
	return contentCommand<{ editionId: string }>(
		'/content/editorial/week-editions',
		'editor',
		input,
		options
	)
}

export function addBriefingWeekEditionItem(
	editionId: string,
	input: {
		storyId: string
		sectionKey: string
		placement?: 'featured' | 'standard'
		position: number
	},
	options: ContentCommandOptions
) {
	return contentCommand<void>(
		`/content/editorial/week-editions/${encodeURIComponent(editionId)}/items`,
		'editor',
		input,
		options
	)
}

export function markBriefingWeekEditionReady(
	editionId: string,
	options: ContentCommandOptions
) {
	return contentCommand<{
		editionId: string
		status: 'READY'
		frozenSha256: string
		replayed: boolean
	}>(
		`/content/editorial/week-editions/${encodeURIComponent(editionId)}/ready`,
		'editor',
		{},
		options
	)
}

export function publishBriefingWeekEdition(
	editionId: string,
	input: {
		expectedFrozenSha256: string
		validUntil?: string | null
		reason: string
	},
	options: ContentCommandOptions
) {
	return contentCommand<{
		publicationId: string
		revision: number
		state: 'READY' | 'EMPTY' | 'STALE' | 'OFFSEASON' | 'UNAVAILABLE' | 'REMOVED'
		replayed: boolean
	}>(
		`/content/briefing/week/editions/${encodeURIComponent(editionId)}/publish`,
		'publisher',
		input,
		options
	)
}
