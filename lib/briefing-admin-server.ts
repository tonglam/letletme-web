import 'server-only'

type ContentCommandRole = 'editor' | 'publisher'

type ContentCommandResponse<T> = {
	success: boolean
	data?: T
	error?: string
}

const dataBaseUrl = () => (process.env.LETLETME_DATA_URL ?? '').trim().replace(/\/$/, '')

const keyForRole = (role: ContentCommandRole) =>
	(role === 'publisher'
		? process.env.LETLETME_CONTENT_PUBLISHER_API_KEY
		: process.env.LETLETME_CONTENT_EDITOR_API_KEY
	)?.trim() ?? ''

async function contentCommand<T>(
	path: string,
	role: ContentCommandRole,
	body: unknown,
): Promise<T> {
	const baseUrl = dataBaseUrl()
	const apiKey = keyForRole(role)
	if (!baseUrl || !apiKey) throw new Error(`Briefing ${role} command is not configured`)
	const response = await fetch(`${baseUrl}${path}`, {
		method: 'POST',
		cache: 'no-store',
		headers: {
			'content-type': 'application/json',
			'x-api-key': apiKey,
		},
		body: JSON.stringify(body),
	})
	const result = (await response.json().catch(() => null)) as ContentCommandResponse<T> | null
	if (!response.ok || !result?.success) {
		throw new Error(result?.error ?? `Content command failed (${response.status})`)
	}
	return result.data as T
}

export function upsertBriefingSourceGroup(input: {
	groupKey: string
	displayName: string
	pollPolicy?: Record<string, unknown>
}) {
	return contentCommand<{ groupId: string }>('/content/sources/groups', 'editor', input)
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
	return contentCommand<{ sourceId: string }>('/content/sources', 'editor', input)
}

export function attachBriefingSource(groupKey: string, sourceId: string) {
	return contentCommand<{ success: true }>(
		`/content/sources/groups/${encodeURIComponent(groupKey)}/members/${encodeURIComponent(sourceId)}`,
		'editor',
		{},
	)
}

export function publishBriefingWeek(body: { en: unknown; 'zh-CN': unknown }) {
	return contentCommand<{ publicationId: string; revision: number }>(
		'/content/briefing/week/publish',
		'publisher',
		body,
	)
}
