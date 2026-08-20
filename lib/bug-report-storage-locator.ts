export type BugReportStorageLocator = {
	bucket: string
	path: string
	public: boolean
}

export function parseBugReportStorageLocator(
	locator: string
): BugReportStorageLocator | null {
	try {
		const url = new URL(locator)
		const configured = process.env.NEXT_PUBLIC_SUPABASE_URL
		if (!configured || new URL(configured).origin !== url.origin) return null
		const prefix = '/storage/v1/object/'
		if (!url.pathname.startsWith(prefix)) return null
		const segments = url.pathname.slice(prefix.length).split('/')
		const isPublic = segments[0] === 'public'
		const bucketIndex = isPublic ? 1 : 0
		if (!segments[bucketIndex] || segments.length <= bucketIndex + 1)
			return null
		const bucket = decodeURIComponent(segments[bucketIndex])
		const path = decodeURIComponent(segments.slice(bucketIndex + 1).join('/'))
		if (!bucket || !path || path.includes('..') || path.startsWith('/'))
			return null
		return { bucket, path, public: isPublic }
	} catch {
		return null
	}
}
