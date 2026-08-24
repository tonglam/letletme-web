import {
	MiniProgramAuthError,
	assertValidWeChatLoginCode,
	normalizeOptionalWeChatUnionId,
	normalizeWeChatOpenId
} from '@/lib/miniprogram-account-core'
import { logSafeAuthDiagnostic } from '@/lib/auth-safe-log'

const WECHAT_CODE_SESSION_URL = 'https://api.weixin.qq.com/sns/jscode2session'

export interface WeChatIdentity {
	openId: string
	unionId: string | null
}

export async function exchangeWeChatCode({
	codeInput,
	appId,
	appSecret,
	fetcher = fetch,
	timeoutMs = 10_000
}: {
	codeInput: unknown
	appId: string | undefined
	appSecret: string | undefined
	fetcher?: typeof fetch
	timeoutMs?: number
}): Promise<WeChatIdentity> {
	const code = assertValidWeChatLoginCode(codeInput)
	if (!appId || !appSecret) {
		throw new MiniProgramAuthError(
			'WeChat Mini Program login is not configured',
			500
		)
	}

	const params = new URLSearchParams({
		appid: appId,
		secret: appSecret,
		js_code: code,
		grant_type: 'authorization_code'
	})

	let response: Response
	try {
		response = await fetcher(
			`${WECHAT_CODE_SESSION_URL}?${params.toString()}`,
			{
				method: 'GET',
				cache: 'no-store',
				signal: AbortSignal.timeout(timeoutMs)
			}
		)
	} catch {
		logSafeAuthDiagnostic('warn', 'better-auth diagnostic', {
			name: 'WeChatCodeExchangeUnavailable',
			code: 'wechat_upstream_unavailable'
		})
		throw new MiniProgramAuthError(
			'WeChat login is temporarily unavailable',
			503,
			undefined,
			'wechat_upstream_unavailable'
		)
	}

	type Code2SessionResponse = {
		openid?: string
		unionid?: string
		errcode?: number
		errmsg?: string
	}

	let payload: Code2SessionResponse
	try {
		payload = (await response.json()) as Code2SessionResponse
	} catch {
		logSafeAuthDiagnostic('warn', 'better-auth diagnostic', {
			name: 'WeChatCodeExchangeInvalidResponse',
			code: 'wechat_upstream_unavailable',
			status: response.status
		})
		throw new MiniProgramAuthError(
			'WeChat login is temporarily unavailable',
			503,
			undefined,
			'wechat_upstream_unavailable'
		)
	}

	if (!response.ok || !payload.openid || payload.errcode) {
		logSafeAuthDiagnostic('warn', 'better-auth diagnostic', {
			name: 'WeChatCodeExchangeRejected',
			code: 'wechat_upstream_rejected',
			status: response.status,
			errcode: payload.errcode
		})
		throw new MiniProgramAuthError(
			'WeChat login failed',
			401,
			undefined,
			'wechat_upstream_rejected'
		)
	}

	return {
		openId: normalizeWeChatOpenId(payload.openid),
		unionId: normalizeOptionalWeChatUnionId(payload.unionid)
	}
}
