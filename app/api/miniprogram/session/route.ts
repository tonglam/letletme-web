import { revokeMiniProgramSession } from '@/lib/miniprogram-account'
import { getBearerToken, MiniProgramAuthError } from '@/lib/miniprogram-account-core'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function DELETE(request: Request) {
	try {
		const token = getBearerToken(request.headers.get('authorization'))
		if (!token) {
			throw new MiniProgramAuthError('Unauthenticated', 401)
		}

		await revokeMiniProgramSession(token)
		return NextResponse.json({ success: true })
	} catch (error) {
		const status = error instanceof MiniProgramAuthError ? error.status : 500
		const message = error instanceof Error ? error.message : 'Failed to sign out'
		return NextResponse.json({ success: false, error: message }, { status })
	}
}
