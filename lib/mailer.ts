import 'server-only'

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.MAIL_FROM ?? 'no-reply@letletme.top'

export async function sendVerificationEmail({
	to,
	verifyUrl,
}: {
	to: string
	verifyUrl: string
}) {
	await resend.emails.send({
		from: FROM,
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
	await resend.emails.send({
		from: FROM,
		to,
		subject: 'Reset your LetLetMe password',
		html: `<p>Click the link below to reset your password:</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>This link expires in 1 hour. If you did not request a reset, ignore this email.</p>`,
	})
}
