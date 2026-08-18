import 'server-only'

import { randomUUID } from 'node:crypto'

type ContentCommandRole = 'editor' | 'publisher'

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
	options: { idempotencyKey?: string; actorId?: string } = {}
): Promise<T> {
	const baseUrl = dataBaseUrl()
	const apiKey = keyForRole(role)
	if (!baseUrl || !apiKey)
		throw new Error(`Briefing ${role} command is not configured`)
	const response = await fetch(`${baseUrl}${path}`, {
		method: 'POST',
		cache: 'no-store',
		headers: {
			'content-type': 'application/json',
			'x-api-key': apiKey,
			'idempotency-key': options.idempotencyKey ?? randomUUID(),
			...(options.actorId ? { 'x-actor-id': options.actorId } : {})
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
}) {
	return contentCommand<{ groupId: string }>(
		'/content/sources/groups',
		'editor',
		input
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
}) {
	return contentCommand<{ sourceId: string }>(
		'/content/sources',
		'editor',
		input
	)
}

export function attachBriefingSource(groupKey: string, sourceId: string) {
	return contentCommand<{ success: true }>(
		`/content/sources/groups/${encodeURIComponent(groupKey)}/members/${encodeURIComponent(sourceId)}`,
		'editor',
		{}
	)
}

export function publishBriefingWeek(body: { en: unknown; 'zh-CN': unknown }) {
	return contentCommand<{ publicationId: string; revision: number }>(
		'/content/briefing/week/publish',
		'publisher',
		body
	)
}

export function createBriefingCandidate(
	input: {
		runId: string
		canonicalHash: string
		materiality?: string
		receiptIds: string[]
	},
	options?: { idempotencyKey?: string; actorId?: string }
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
	options?: { idempotencyKey?: string; actorId?: string }
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
	options?: { idempotencyKey?: string; actorId?: string }
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
	options?: { idempotencyKey?: string; actorId?: string }
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
	options?: { idempotencyKey?: string; actorId?: string }
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
	options?: { idempotencyKey?: string; actorId?: string }
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
	},
	options?: { idempotencyKey?: string; actorId?: string }
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
	options?: { idempotencyKey?: string; actorId?: string }
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
	options?: { idempotencyKey?: string; actorId?: string }
) {
	return contentCommand<void>(
		`/content/editorial/week-editions/${encodeURIComponent(editionId)}/ready`,
		'editor',
		{},
		options
	)
}

export function publishBriefingWeekEdition(
	editionId: string,
	input: {
		revision: number
		publicationId: string
		sourceCheckedAt: string
		publishedAt: string
		validUntil?: string | null
	},
	options?: { idempotencyKey?: string; actorId?: string }
) {
	return contentCommand<{ publicationId: string; revision: number }>(
		`/content/briefing/week/editions/${encodeURIComponent(editionId)}/publish`,
		'publisher',
		input,
		options
	)
}
