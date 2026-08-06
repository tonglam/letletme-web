'use client'

import { copyTextToClipboard } from '@/app/live/points/_lib/live-points-share'
import { Button } from '@/components/ui/button'
import { localizePathname, type AppLocale } from '@/i18n/routing'
import type { Match } from '@/types/match'
import { Check, Copy } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { formatMatchShareText } from './match-share'

export function MatchShareButton({ match }: { match: Match }) {
	const t = useTranslations('LiveMatches')
	const locale = useLocale() as AppLocale
	const [copied, setCopied] = useState(false)

	const handleCopy = useCallback(async () => {
		const origin =
			typeof window !== 'undefined'
				? window.location.origin
				: 'https://letletme.top'
		const shareUrl = new URL(
			localizePathname('/live/matches', locale),
			origin,
		).toString()

		const text = formatMatchShareText(match, {
			liveMinute: minute => t('liveMinute', { minute }),
			halfTime: t('halfTime'),
			fullTime: t('fullTime'),
			notStarted: t('notStarted'),
			upcoming: t('upcoming'),
			goals: t('goals'),
			assists: t('assists'),
			bonusPoints: t('bonusPoints'),
			bps: t('bps'),
			defensiveContribution: t('defensiveContribution'),
			saves: t('saves'),
			yellowCards: t('yellowCards'),
			redCards: t('redCards'),
			footer: t('shareFooter', { url: shareUrl }),
		})

		const ok = await copyTextToClipboard(text)
		if (ok) {
			setCopied(true)
			toast.success(t('shareCopied'))
			window.setTimeout(() => setCopied(false), 2000)
		} else {
			toast.error(t('shareCopyFailed'))
		}
	}, [locale, match, t])

	return (
		<Button
			type="button"
			variant="outline"
			size="icon"
			className="size-8 rounded-full border-border/70 bg-card/90 shadow-sm backdrop-blur-sm hover:bg-accent"
			onClick={() => void handleCopy()}
			aria-label={copied ? t('shareCopiedShort') : t('shareCopy')}
			title={copied ? t('shareCopiedShort') : t('shareCopy')}
		>
			{copied ? (
				<Check className="size-3.5 text-primary-ink" aria-hidden="true" />
			) : (
				<Copy className="size-3.5" aria-hidden="true" />
			)}
		</Button>
	)
}
