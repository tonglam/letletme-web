import type { AppLocale } from '@/i18n/routing'

export type TransactionalEmail = {
	subject: string
	preview: string
	html: string
	text: string
}

type EmailAction = {
	label: string
	url: string
	fallbackLabel: string
}

type EmailTemplateOptions = {
	locale: AppLocale
	subject: string
	preview: string
	eyebrow: string
	title: string
	intro: string
	action?: EmailAction
	code?: string
	noticeTitle: string
	noticeBody: string
	safety: string
	footer: string
}

const BRAND = {
	plum: '#240526',
	plumSoft: '#3b123f',
	electric: '#00ff85',
	pink: '#ff2882',
	chalk: '#f6f3ed',
	paper: '#ffffff',
	ink: '#2b1730',
	muted: '#665b69',
	border: '#ded6df',
} as const

function escapeHtml(value: string): string {
	return value.replace(/[&<>'"]/g, character => {
		switch (character) {
			case '&':
				return '&amp;'
			case '<':
				return '&lt;'
			case '>':
				return '&gt;'
			case "'":
				return '&#39;'
			case '"':
				return '&quot;'
			default:
				return character
		}
	})
}

function emailSafeUrl(value: string): string {
	let parsed: URL
	try {
		parsed = new URL(value)
	} catch {
		throw new Error('Email action URL must be an absolute URL')
	}
	if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
		throw new Error('Email action URL must use http or https')
	}
	return escapeHtml(value)
}

function wordmark(): string {
	return `<span style="color:${BRAND.electric};">L</span>et<span style="color:${BRAND.electric};">L</span>et<span style="color:${BRAND.electric};">M</span>e`
}

function renderAction(action: EmailAction): string {
	const url = emailSafeUrl(action.url)
	return `
		<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 28px 0;">
			<tr>
				<td bgcolor="${BRAND.electric}" style="border-radius:8px;box-shadow:4px 4px 0 ${BRAND.plumSoft};">
					<a href="${url}" style="display:inline-block;padding:15px 26px;font-family:'Arial Narrow','Aptos Narrow',Arial,sans-serif;font-size:16px;line-height:20px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.plum};text-decoration:none;border-radius:8px;">${escapeHtml(action.label)} &nbsp;&rarr;</a>
				</td>
			</tr>
		</table>`
}

function renderFallback(action: EmailAction): string {
	const url = emailSafeUrl(action.url)
	return `
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
			<tr>
				<td style="padding-top:22px;border-top:1px solid ${BRAND.border};">
					<p style="margin:0 0 8px 0;font-family:Arial,'Helvetica Neue',sans-serif;font-size:12px;line-height:18px;color:${BRAND.muted};">${escapeHtml(action.fallbackLabel)}</p>
					<p style="margin:0;font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:11px;line-height:17px;word-break:break-all;color:${BRAND.muted};">
						<a href="${url}" style="color:${BRAND.plumSoft};text-decoration:underline;">${url}</a>
					</p>
				</td>
			</tr>
		</table>`
}

function renderCode(code: string): string {
	return `
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 28px 0;">
			<tr>
				<td align="center" bgcolor="${BRAND.chalk}" style="padding:22px 18px;border:1px solid ${BRAND.border};border-left:5px solid ${BRAND.electric};border-radius:8px;">
					<span style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:32px;line-height:38px;font-weight:700;letter-spacing:0.22em;color:${BRAND.plum};">${escapeHtml(code)}</span>
				</td>
			</tr>
		</table>`
}

function renderTransactionalEmail(
	options: EmailTemplateOptions,
): TransactionalEmail {
	const actionMarkup = options.action ? renderAction(options.action) : ''
	const fallbackMarkup = options.action ? renderFallback(options.action) : ''
	const codeMarkup = options.code ? renderCode(options.code) : ''
	const lang = options.locale === 'zh-CN' ? 'zh-CN' : 'en'
	const actionText = options.action
		? `\n\n${options.action.label}: ${options.action.url}`
		: ''
	const codeText = options.code ? `\n\n${options.code}` : ''
	const text = `${options.title}\n\n${options.intro}${actionText}${codeText}\n\n${options.noticeTitle}. ${options.noticeBody}\n\n${options.safety}\n\nLetLetMe — ${options.footer}\nhttps://letletme.top`

	const html = `<!doctype html>
<html lang="${lang}">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<meta name="x-apple-disable-message-reformatting">
		<meta name="color-scheme" content="light">
		<meta name="supported-color-schemes" content="light">
		<title>${escapeHtml(options.subject)}</title>
		<style>
			@media only screen and (max-width: 620px) {
				.email-shell { width: 100% !important; }
				.email-gutter { padding-left: 22px !important; padding-right: 22px !important; }
				.email-title { font-size: 32px !important; line-height: 35px !important; }
			}
			a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
		</style>
	</head>
	<body style="margin:0;padding:0;background:${BRAND.chalk};-webkit-font-smoothing:antialiased;">
		<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(options.preview)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.chalk}" style="width:100%;background:${BRAND.chalk};">
			<tr>
				<td align="center" style="padding:36px 14px;">
					<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-shell" style="width:600px;max-width:600px;">
						<tr>
							<td class="email-gutter" bgcolor="${BRAND.plum}" style="padding:24px 34px 22px 34px;border-bottom:4px solid ${BRAND.electric};border-radius:14px 14px 0 0;">
								<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
									<tr>
										<td style="font-family:'Arial Narrow','Aptos Narrow',Arial,sans-serif;font-size:22px;line-height:26px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.paper};">${wordmark()}</td>
										<td align="right" style="font-family:'Arial Narrow','Aptos Narrow',Arial,sans-serif;font-size:10px;line-height:14px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#bdb0c0;">FPL decision desk&nbsp;&nbsp;<span style="color:${BRAND.pink};">&#9679;</span></td>
									</tr>
								</table>
							</td>
						</tr>
						<tr>
							<td class="email-gutter" bgcolor="${BRAND.paper}" style="padding:42px 44px 40px 44px;border-left:1px solid ${BRAND.border};border-right:1px solid ${BRAND.border};">
								<p style="margin:0 0 14px 0;font-family:'Arial Narrow','Aptos Narrow',Arial,sans-serif;font-size:11px;line-height:15px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#7a297d;">${escapeHtml(options.eyebrow)}</p>
								<h1 class="email-title" style="margin:0 0 18px 0;font-family:'Arial Narrow','Aptos Narrow',Arial,sans-serif;font-size:38px;line-height:41px;font-weight:800;letter-spacing:-0.02em;color:${BRAND.ink};">${escapeHtml(options.title)}</h1>
								<p style="margin:0;font-family:Arial,'Helvetica Neue',sans-serif;font-size:16px;line-height:25px;color:${BRAND.muted};">${escapeHtml(options.intro)}</p>
								${actionMarkup}
								${codeMarkup}
								<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
									<tr>
										<td bgcolor="#f5f2f6" style="padding:16px 18px;border-left:4px solid ${BRAND.pink};border-radius:6px;">
											<p style="margin:0 0 3px 0;font-family:'Arial Narrow','Aptos Narrow',Arial,sans-serif;font-size:13px;line-height:18px;font-weight:700;color:${BRAND.ink};">${escapeHtml(options.noticeTitle)}</p>
											<p style="margin:0;font-family:Arial,'Helvetica Neue',sans-serif;font-size:13px;line-height:20px;color:${BRAND.muted};">${escapeHtml(options.noticeBody)}</p>
										</td>
									</tr>
								</table>
								<p style="margin:22px 0 0 0;font-family:Arial,'Helvetica Neue',sans-serif;font-size:13px;line-height:20px;color:${BRAND.muted};">${escapeHtml(options.safety)}</p>
								${fallbackMarkup}
							</td>
						</tr>
						<tr>
							<td class="email-gutter" bgcolor="#eee9e2" style="padding:20px 34px 22px 34px;border:1px solid ${BRAND.border};border-top:0;border-radius:0 0 14px 14px;">
								<p style="margin:0 0 5px 0;font-family:'Arial Narrow','Aptos Narrow',Arial,sans-serif;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.ink};">LetLetMe</p>
								<p style="margin:0;font-family:Arial,'Helvetica Neue',sans-serif;font-size:11px;line-height:17px;color:${BRAND.muted};">${escapeHtml(options.footer)} &nbsp;&middot;&nbsp; <a href="https://letletme.top" style="color:${BRAND.plumSoft};text-decoration:underline;">letletme.top</a></p>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
</html>`

	return {
		subject: options.subject,
		preview: options.preview,
		html,
		text,
	}
}

export function buildVerificationEmail({
	verifyUrl,
	locale = 'en',
}: {
	verifyUrl: string
	locale?: AppLocale
}): TransactionalEmail {
	const chinese = locale === 'zh-CN'
	return renderTransactionalEmail({
		locale,
		subject: chinese ? '验证你的 LetLetMe 账户' : 'Verify your LetLetMe account',
		preview: chinese
			? '验证邮箱，完成 LetLetMe 账户设置。'
			: 'Confirm your email and finish setting up LetLetMe.',
		eyebrow: chinese ? '账户验证' : 'Account access',
		title: chinese ? '一步完成验证' : "One click. You're in.",
		intro: chinese
			? '确认这个邮箱地址，即可激活 LetLetMe 账户，开始使用你的 FPL 决策工作台。'
			: 'Confirm this email address to activate your LetLetMe account and unlock your FPL decision desk.',
		action: {
			label: chinese ? '验证邮箱' : 'Verify email',
			url: verifyUrl,
			fallbackLabel: chinese
				? '按钮无法打开？复制下面的安全链接到浏览器：'
				: 'Button not working? Copy and paste this secure link into your browser:',
		},
		noticeTitle: chinese
			? '链接将在 24 小时后过期'
			: 'This link expires in 24 hours',
		noticeBody: chinese
			? '为保障账户安全，验证链接仅可使用一次。'
			: 'For your security, the verification link can only be used once.',
		safety: chinese
			? '如果你没有注册 LetLetMe，可以安全忽略这封邮件。'
			: "Didn't create a LetLetMe account? You can safely ignore this email.",
		footer: chinese
			? '看清每一分，少一点噪音。'
			: 'Sharper FPL decisions, without the noise.',
	})
}

export function buildPasswordResetEmail({
	resetUrl,
	locale = 'en',
}: {
	resetUrl: string
	locale?: AppLocale
}): TransactionalEmail {
	const chinese = locale === 'zh-CN'
	return renderTransactionalEmail({
		locale,
		subject: chinese ? '重置你的 LetLetMe 密码' : 'Reset your LetLetMe password',
		preview: chinese
			? '使用安全链接设置新的 LetLetMe 密码。'
			: 'Use this secure link to set a new LetLetMe password.',
		eyebrow: chinese ? '账户安全' : 'Account security',
		title: chinese ? '设置新密码' : 'Set a new password',
		intro: chinese
			? '我们收到了你的密码重置申请。使用下面的安全链接设置新密码。'
			: 'We received a request to reset your password. Use the secure link below to choose a new one.',
		action: {
			label: chinese ? '重置密码' : 'Reset password',
			url: resetUrl,
			fallbackLabel: chinese
				? '按钮无法打开？复制下面的安全链接到浏览器：'
				: 'Button not working? Copy and paste this secure link into your browser:',
		},
		noticeTitle: chinese
			? '链接将在 1 小时后过期'
			: 'This link expires in 1 hour',
		noticeBody: chinese
			? '为保障账户安全，重置链接仅可使用一次。'
			: 'For your security, the reset link can only be used once.',
		safety: chinese
			? '如果你没有申请重置密码，可以安全忽略这封邮件。'
			: "Didn't request a password reset? You can safely ignore this email.",
		footer: chinese
			? '看清每一分，少一点噪音。'
			: 'Sharper FPL decisions, without the noise.',
	})
}

export function buildMiniProgramEmailCode({
	code,
}: {
	code: string
}): TransactionalEmail {
	return renderTransactionalEmail({
		locale: 'en',
		subject: 'Link your LetLetMe Mini Program',
		preview: 'Use this one-time code to link your LetLetMe account.',
		eyebrow: 'WeChat link',
		title: 'Bring your desk with you',
		intro:
			'Enter this one-time code in the LetLetMe Mini Program to link your website account.',
		code,
		noticeTitle: 'This code expires in 10 minutes',
		noticeBody:
			'It can only be used once and is tied to the current linking request.',
		safety: "Didn't request this link? You can safely ignore this email.",
		footer: 'Your FPL decision desk, wherever matchday takes you.',
	})
}
