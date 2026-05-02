import { startMiniProgramEmailBinding } from '@/lib/miniprogram-account'
import { MiniProgramAuthError } from '@/lib/miniprogram-account-core'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	try {
		const body = await request.json()
		await startMiniProgramEmailBinding({
			email: body?.email,
			deviceId: body?.deviceId,
		})

		return NextResponse.json({
			success: true,
			message: 'If that email belongs to a LetLetMe account, a code has been sent.',
		})
	} catch (error) {
		const status = error instanceof MiniProgramAuthError ? error.status : 500
		const message = error instanceof Error ? error.message : 'Failed to send code'
		return NextResponse.json({ success: false, error: message }, { status })
	}
}
