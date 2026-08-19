import type { AppLocale } from '@/i18n/routing'

/** FPL deadlines are published in UK time; pin display so SSR is not UTC-skewed. */
export const BRIEFING_DISPLAY_TIME_ZONE = 'Europe/London'

export function formatBriefingDate(
	value: string | null,
	locale: AppLocale,
	options?: Intl.DateTimeFormatOptions
): string | null {
	if (!value) return null
	const timestamp = Date.parse(value)
	if (!Number.isFinite(timestamp)) return null
	return new Intl.DateTimeFormat(locale === 'zh-CN' ? 'zh-CN' : 'en-GB', {
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: BRIEFING_DISPLAY_TIME_ZONE,
		...options,
	}).format(timestamp)
}
