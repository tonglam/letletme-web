import { signInMiniProgramWithWeChat } from '@/lib/miniprogram-account'
import { MiniProgramAuthError } from '@/lib/miniprogram-account-core'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	try {
		const body = await request.json()
		const result = await signInMiniProgramWithWeChat({
			code: body?.code,
			deviceId: body?.deviceId,
		})

		return NextResponse.json({ success: true, ...result })
	} catch (error) {
		const status = error instanceof MiniProgramAuthError ? error.status : 500
		const message = error instanceof Error ? error.message : 'Failed to sign in'
		return NextResponse.json({ success: false, error: message }, { status })
	}
}
