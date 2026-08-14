export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function currentOrigin(): 'tencent' | 'vercel' | 'unknown' {
	if (process.env.LETLETME_ORIGIN === 'tencent') return 'tencent'
	if (process.env.LETLETME_ORIGIN === 'vercel' || process.env.VERCEL === '1') {
		return 'vercel'
	}
	return 'unknown'
}

function currentRelease(): string {
	return (
		process.env.LETLETME_RELEASE_SHA ??
		process.env.VERCEL_GIT_COMMIT_SHA ??
		process.env.NEXT_DEPLOYMENT_ID ??
		'unknown'
	)
}

export async function GET() {
	const origin = currentOrigin()
	const release = currentRelease()
	return Response.json(
		{ status: 'ok', origin, release },
		{
			headers: {
				'Cache-Control': 'no-store',
				'X-Letletme-Origin': origin,
				'X-Letletme-Release': release
			}
		}
	)
}
