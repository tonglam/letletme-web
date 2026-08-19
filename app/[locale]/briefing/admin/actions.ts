'use server'

import { publishBriefingWeekEdition } from '@/lib/briefing-admin-server'
import { briefingPublishIdempotencyKey } from '@/lib/briefing-revalidate'
import { getCurrentSession } from '@/lib/session'

type AdminRole = 'editor' | 'publisher'

const configuredEmails = (key: string): Set<string> =>
	new Set(
		(process.env[key] ?? '')
			.split(',')
			.map(email => email.trim().toLowerCase())
			.filter(Boolean)
	)

async function requireAdmin(role: AdminRole) {
	if (process.env.BRIEFING_ADMIN_ENABLED !== 'true')
		throw new Error('Briefing admin is disabled')
	const session = await getCurrentSession()
	const user = session?.user as { id?: string; email?: string } | undefined
	const email = user?.email?.trim().toLowerCase()
	const key =
		role === 'publisher'
			? 'BRIEFING_PUBLISHER_EMAILS'
			: 'BRIEFING_EDITOR_EMAILS'
	if (!email || !configuredEmails(key).has(email))
		throw new Error('Briefing admin role required')
	return user?.id ?? email
}

const required = (formData: FormData, key: string): string => {
	const value = formData.get(key)
	if (typeof value !== 'string' || !value.trim())
		throw new Error(`${key} is required`)
	return value.trim()
}

export async function publishBriefingWeekEditionAction(formData: FormData) {
	const actorId = await requireAdmin('publisher')
	const editionId = required(formData, 'editionId')
	const revision = Number(required(formData, 'revision'))
	if (!Number.isSafeInteger(revision) || revision <= 0)
		throw new Error('revision is invalid')
	const validUntilValue = formData.get('validUntil')
	await publishBriefingWeekEdition(
		editionId,
		{
			revision,
			publicationId: required(formData, 'publicationId'),
			sourceCheckedAt: required(formData, 'sourceCheckedAt'),
			publishedAt: required(formData, 'publishedAt'),
			validUntil:
				typeof validUntilValue === 'string'
					? validUntilValue.trim() || null
					: null,
			reason: required(formData, 'reason')
		},
		{
			actorId,
			idempotencyKey: briefingPublishIdempotencyKey(editionId, revision)
		}
	)
}
