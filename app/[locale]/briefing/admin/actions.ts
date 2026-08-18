'use server'

import { randomUUID } from 'node:crypto'

import { publishBriefingWeekEdition } from '@/lib/briefing-admin-server'
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
	await publishBriefingWeekEdition(
		editionId,
		{
			revision,
			publicationId: required(formData, 'publicationId'),
			sourceCheckedAt: required(formData, 'sourceCheckedAt'),
			publishedAt: required(formData, 'publishedAt'),
			validUntil: (formData.get('validUntil') as string | null)?.trim() || null
		},
		{
			actorId,
			idempotencyKey: `web:briefing:publish:${editionId}:${revision}:${randomUUID()}`
		}
	)
}
