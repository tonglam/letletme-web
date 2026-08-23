import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	buildMiniProgramEmailCode,
	buildPasswordResetEmail,
	buildVerificationEmail,
} from '@/lib/email-templates'

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

describe('transactional email templates', () => {
	it('renders a branded verification email with a text fallback', () => {
		const verifyUrl =
			'https://letletme.top/api/auth/verify-email?token=abc&callbackURL=https%3A%2F%2Fletletme.top%2Fzh-CN'
		const message = buildVerificationEmail({ verifyUrl, locale: 'en' })

		assert.equal(message.subject, 'Verify your LetLetMe account')
		assert.equal(
			message.preview,
			'Confirm your email and finish setting up LetLetMe.',
		)
		assert.match(message.html, /^<!doctype html>/)
		assert.match(message.html, /One click\. You&#39;re in\./)
		assert.match(message.html, />Verify email &nbsp;&rarr;<\/a>/)
		assert.match(message.html, /FPL decision desk/)
		assert.match(message.html, /This link expires in 24 hours/)
		assert.match(message.html, /token=abc&amp;callbackURL=/)
		assert.doesNotMatch(message.html, /token=abc&callbackURL=/)
		assert.match(message.text, new RegExp(escapeRegExp(verifyUrl)))
	})

	it('localizes the verification template in Chinese', () => {
		const message = buildVerificationEmail({
			verifyUrl: 'https://letletme.top/api/auth/verify-email?token=abc',
			locale: 'zh-CN',
		})

		assert.equal(message.subject, '验证你的 LetLetMe 账户')
		assert.match(message.html, /<html lang="zh-CN">/)
		assert.match(message.html, /一步完成验证/)
		assert.match(message.html, />验证邮箱 &nbsp;&rarr;<\/a>/)
		assert.match(message.text, /链接将在 24 小时后过期/)
	})

	it('renders the password reset expiry and action distinctly', () => {
		const message = buildPasswordResetEmail({
			resetUrl: 'https://letletme.top/api/auth/reset-password/reset-token',
			locale: 'en',
		})

		assert.equal(message.subject, 'Reset your LetLetMe password')
		assert.match(message.html, /Set a new password/)
		assert.match(message.html, />Reset password &nbsp;&rarr;<\/a>/)
		assert.match(message.html, /This link expires in 1 hour/)
	})

	it('renders the Mini Program code without allowing HTML injection', () => {
		const message = buildMiniProgramEmailCode({ code: '<123456>' })

		assert.match(message.html, /&lt;123456&gt;/)
		assert.doesNotMatch(message.html, /<123456>/)
		assert.match(message.text, /<123456>/)
		assert.match(message.html, /This code expires in 10 minutes/)
	})

	it('rejects non-web action URLs', () => {
		assert.throws(
			() =>
				buildVerificationEmail({
					verifyUrl: 'javascript:alert(1)',
					locale: 'en',
				}),
			/Email action URL must use http or https/,
		)
	})
})
