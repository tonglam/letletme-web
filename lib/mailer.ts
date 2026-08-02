import 'server-only'

import { Resend } from 'resend'
import type { AppLocale } from '@/i18n/routing'

let _resend: Resend | undefined

function getResend() {
	if (!_resend) {
		const key = process.env.RESEND_API_KEY
		if (!key) throw new Error('RESEND_API_KEY is not set')
		_resend = new Resend(key)
	}
	return _resend
}

const FROM = process.env.MAIL_FROM ?? 'no-reply@letletme.top'

async function sendEmail(options: {
	to: string
	subject: string
	html: string
}): Promise<void> {
	const { data, error } = await getResend().emails.send({
		from: FROM,
		to: options.to,
		subject: options.subject,
		html: options.html,
	})

	if (error) {
		throw new Error(`Failed to send email: ${error.message}`)
	}

	if (!data?.id) {
		throw new Error('Failed to send email: no message id returned')
	}
}

export async function sendVerificationEmail({
	to,
	verifyUrl,
	locale = 'en',
}: {
	to: string
	verifyUrl: string
	locale?: AppLocale
}) {
	const chinese = locale === 'zh-CN'
	await sendEmail({
		to,
		subject: chinese ? '验证您的 LetLetMe 账户' : 'Verify your LetLetMe account',
		html: chinese
			? `<p>点击下方链接验证您的邮箱地址：</p>
<p><a href="${verifyUrl}">${verifyUrl}</a></p>
<p>此链接将在 24 小时后过期。如果您没有注册，请忽略此邮件。</p>`
			: `<p>Click the link below to verify your email address:</p>
<p><a href="${verifyUrl}">${verifyUrl}</a></p>
<p>This link expires in 24 hours. If you did not sign up, ignore this email.</p>`,
	})
}

export async function sendPasswordResetEmail({
	to,
	resetUrl,
	locale = 'en',
}: {
	to: string
	resetUrl: string
	locale?: AppLocale
}) {
	const chinese = locale === 'zh-CN'
	await sendEmail({
		to,
		subject: chinese ? '重置您的 LetLetMe 密码' : 'Reset your LetLetMe password',
		html: chinese
			? `<p>点击下方链接重置您的密码：</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>此链接将在 1 小时后过期。如果您没有申请重置密码，请忽略此邮件。</p>`
			: `<p>Click the link below to reset your password:</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>This link expires in 1 hour. If you did not request a reset, ignore this email.</p>`,
	})
}

export async function sendMiniProgramEmailCode({
	to,
	code,
}: {
	to: string
	code: string
}) {
	await sendEmail({
		to,
		subject: 'Link your LetLetMe Mini Program',
		html: `<p>Use this code to link your LetLetMe account in the WeChat Mini Program:</p>
<p style="font-size: 24px; font-weight: 700; letter-spacing: 4px;">${code}</p>
<p>This code expires in 10 minutes. If you did not request this, ignore this email.</p>`,
	})
}
