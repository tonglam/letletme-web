import 'server-only'

import { Resend } from 'resend'
import type { AppLocale } from '@/i18n/routing'
import {
	buildMiniProgramEmailCode,
	buildPasswordResetEmail,
	buildVerificationEmail,
	type TransactionalEmail,
} from '@/lib/email-templates'

let _resend: Resend | undefined

function getResend() {
	if (!_resend) {
		const key = process.env.RESEND_API_KEY
		if (!key) throw new Error('RESEND_API_KEY is not set')
		_resend = new Resend(key)
	}
	return _resend
}

const fromAddress = process.env.MAIL_FROM ?? 'no-reply@letletme.top'
const FROM = fromAddress.includes('<') ? fromAddress : `LetLetMe <${fromAddress}>`

async function sendEmail(
	options: TransactionalEmail & { to: string },
): Promise<void> {
	const { data, error } = await getResend().emails.send({
		from: FROM,
		to: options.to,
		subject: options.subject,
		html: options.html,
		text: options.text,
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
	await sendEmail({
		to,
		...buildVerificationEmail({ verifyUrl, locale }),
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
	await sendEmail({
		to,
		...buildPasswordResetEmail({ resetUrl, locale }),
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
		...buildMiniProgramEmailCode({ code }),
	})
}
