import 'server-only'

import { Resend } from 'resend'

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
}: {
	to: string
	verifyUrl: string
}) {
	await sendEmail({
		to,
		subject: 'Verify your LetLetMe account',
		html: `<p>Click the link below to verify your email address:</p>
<p><a href="${verifyUrl}">${verifyUrl}</a></p>
<p>This link expires in 24 hours. If you did not sign up, ignore this email.</p>`,
	})
}

export async function sendPasswordResetEmail({
	to,
	resetUrl,
}: {
	to: string
	resetUrl: string
}) {
	await sendEmail({
		to,
		subject: 'Reset your LetLetMe password',
		html: `<p>Click the link below to reset your password:</p>
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
