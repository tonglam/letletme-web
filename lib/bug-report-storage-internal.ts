import { createHash } from 'node:crypto'

import {
	AVATAR_BUCKET,
	BUG_REPORT_SCREENSHOT_BUCKET,
	getSupabaseAdmin
} from '@/lib/supabase-storage'
import {
	buildPrivateBugReportLocator,
	BugReportStorageInputError,
	parseLegacyBugReportLocator,
	parseManagedBugReportLocator
} from '@/lib/bug-report-storage-contract'

export const BUG_REPORT_SCREENSHOT_MAX_BYTES = 2 * 1024 * 1024

const SUPPORTED_CONTENT_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif'
])
const EXTENSION_CONTENT_TYPES: Record<string, string> = {
	gif: 'image/gif',
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp'
}

export class BugReportStorageObjectMissingError extends Error {}

function isObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function contentTypeForBlob(blob: Blob, objectPath: string): string {
	const fromBlob = blob.type.trim().toLowerCase()
	if (SUPPORTED_CONTENT_TYPES.has(fromBlob)) return fromBlob
	const extension = objectPath.split('.').at(-1)?.toLowerCase() ?? ''
	const fromExtension = EXTENSION_CONTENT_TYPES[extension]
	if (fromExtension) return fromExtension
	throw new BugReportStorageInputError('Unsupported screenshot content type')
}

function uuidFromLocator(locator: string): string {
	const digest = createHash('sha256').update(locator, 'utf8').digest('hex')
	return [
		digest.slice(0, 8),
		digest.slice(8, 12),
		`5${digest.slice(13, 16)}`,
		`8${digest.slice(17, 20)}`,
		digest.slice(20, 32)
	].join('-')
}

function storageErrorStatus(error: unknown): string | null {
	if (!isObject(error)) return null
	for (const key of ['statusCode', 'status']) {
		const value = error[key]
		if (typeof value === 'string' || typeof value === 'number') return String(value)
	}
	return null
}

function isMissingStorageError(error: unknown): boolean {
	const status = storageErrorStatus(error)
	if (status === '404') return true
	if (!isObject(error)) return false
	const message = typeof error.message === 'string' ? error.message : ''
	return /not[ _-]?found|does not exist|object missing/i.test(message)
}

export async function migrateLegacyBugReportScreenshot(locator: string): Promise<string> {
	const sourcePath = parseLegacyBugReportLocator(locator)
	const admin = getSupabaseAdmin()
	const { data, error } = await admin.storage.from(AVATAR_BUCKET).download(sourcePath)
	if (error) {
		if (isMissingStorageError(error)) throw new BugReportStorageObjectMissingError()
		throw error
	}
	if (!data) throw new BugReportStorageObjectMissingError()
	if (data.size > BUG_REPORT_SCREENSHOT_MAX_BYTES)
		throw new BugReportStorageInputError('Screenshot exceeds the private bucket limit')
	const contentType = contentTypeForBlob(data, sourcePath)
	const objectKey = `bug-reports/${uuidFromLocator(locator)}.${
		contentType === 'image/jpeg'
			? 'jpg'
			: contentType.slice('image/'.length)
	}`
	const { error: uploadError } = await admin.storage
		.from(BUG_REPORT_SCREENSHOT_BUCKET)
		.upload(objectKey, Buffer.from(await data.arrayBuffer()), {
			contentType,
			upsert: true
		})
	if (uploadError) throw uploadError
	return buildPrivateBugReportLocator(objectKey)
}

export async function deleteBugReportScreenshot(
	locator: string
): Promise<'deleted' | 'missing'> {
	const { bucket, objectPath } = parseManagedBugReportLocator(locator)
	const { error } = await getSupabaseAdmin()
		.storage.from(bucket)
		.remove([objectPath])
	if (!error) return 'deleted'
	if (isMissingStorageError(error)) return 'missing'
	throw error
}
