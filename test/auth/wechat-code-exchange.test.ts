import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { MiniProgramAuthError } from '../../lib/miniprogram-account-core'
import { exchangeWeChatCode } from '../../lib/wechat-code-exchange'

describe('WeChat code exchange', () => {
	it('exchanges a fresh wx.login code without exposing credentials to the client', async () => {
		let requestedUrl = ''
		const identity = await exchangeWeChatCode({
			codeInput: 'fresh-login-code',
			appId: 'mini-app-id',
			appSecret: 'mini-app-secret',
			fetcher: async input => {
				requestedUrl = String(input)
				return Response.json({
					openid: 'openid_12345678',
					unionid: 'unionid_12345678'
				})
			}
		})

		assert.deepEqual(identity, {
			openId: 'openid_12345678',
			unionId: 'unionid_12345678'
		})
		const request = new URL(requestedUrl)
		assert.equal(request.origin, 'https://api.weixin.qq.com')
		assert.equal(request.searchParams.get('js_code'), 'fresh-login-code')
		assert.equal(request.searchParams.get('appid'), 'mini-app-id')
		assert.equal(request.searchParams.get('secret'), 'mini-app-secret')
	})

	it('maps rejected codes to one generic authentication error', async () => {
		await assert.rejects(
			() =>
				exchangeWeChatCode({
					codeInput: 'expired-login-code',
					appId: 'mini-app-id',
					appSecret: 'mini-app-secret',
					fetcher: async () =>
						Response.json({ errcode: 40029, errmsg: 'invalid code' })
				}),
			(error: unknown) =>
				error instanceof MiniProgramAuthError &&
				error.status === 401 &&
				error.message === 'WeChat login failed' &&
				!error.message.includes('40029')
		)
	})

	it('preserves an upstream outage as a temporary service error', async () => {
		await assert.rejects(
			() =>
				exchangeWeChatCode({
					codeInput: 'fresh-login-code',
					appId: 'mini-app-id',
					appSecret: 'mini-app-secret',
					fetcher: async () =>
						Response.json(
							{ errcode: -1, errmsg: 'temporary outage' },
							{ status: 503 }
						)
				}),
			(error: unknown) =>
				error instanceof MiniProgramAuthError &&
				error.status === 503 &&
				error.code === 'wechat_upstream_unavailable' &&
				error.message === 'WeChat login is temporarily unavailable'
		)
	})

	it('fails closed when credentials or the upstream exchange are unavailable', async () => {
		await assert.rejects(
			() =>
				exchangeWeChatCode({
					codeInput: 'fresh-login-code',
					appId: '',
					appSecret: ''
				}),
			(error: unknown) =>
				error instanceof MiniProgramAuthError && error.status === 500
		)
		await assert.rejects(
			() =>
				exchangeWeChatCode({
					codeInput: 'fresh-login-code',
					appId: 'mini-app-id',
					appSecret: 'mini-app-secret',
					fetcher: async () => {
						throw new Error('offline')
					}
				}),
			(error: unknown) =>
				error instanceof MiniProgramAuthError && error.status === 503
		)
	})
})
