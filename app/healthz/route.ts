export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function currentOrigin(): 'tencent' | 'overseas' | 'vercel' | 'unknown' {
	if (process.env.LETLETME_ORIGIN === 'tencent') return 'tencent'
	if (process.env.LETLETME_ORIGIN === 'overseas') return 'overseas'
	if (process.env.LETLETME_ORIGIN === 'vercel' || process.env.VERCEL === '1') {
		return 'vercel'
	}
	return 'unknown'
}

function currentRelease(): string {
	const candidates =
		process.env.VERCEL === '1'
			? [
					process.env.VERCEL_GIT_COMMIT_SHA,
					process.env.LETLETME_RELEASE_SHA,
					process.env.NEXT_DEPLOYMENT_ID
			  ]
			: [
					process.env.LETLETME_RELEASE_SHA,
					process.env.VERCEL_GIT_COMMIT_SHA,
					process.env.NEXT_DEPLOYMENT_ID
			  ]
	return candidates.find(Boolean) ?? 'unknown'
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
