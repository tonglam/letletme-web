import { getMiniProgramProfileByToken } from '@/lib/miniprogram-account'
import { getBearerToken, MiniProgramAuthError } from '@/lib/miniprogram-account-core'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
	try {
		const token = getBearerToken(request.headers.get('authorization'))
		if (!token) {
			throw new MiniProgramAuthError('Unauthenticated', 401)
		}

		const profile = await getMiniProgramProfileByToken(token)
		return NextResponse.json({ success: true, profile })
	} catch (error) {
		const status = error instanceof MiniProgramAuthError ? error.status : 500
		const message = error instanceof Error ? error.message : 'Failed to load profile'
		return NextResponse.json({ success: false, error: message }, { status })
	}
}
