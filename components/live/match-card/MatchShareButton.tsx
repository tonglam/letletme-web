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

export function MatchShareButton({
	match,
	onManualShareTextChange
}: {
	match: Match
	onManualShareTextChange: (text: string | null) => void
}) {
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
			provisional: t('pendingFinal'),
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

		const result = await copyTextToClipboard(text)
		if (result === 'copied') {
			onManualShareTextChange(null)
			setCopied(true)
			toast.success(t('shareCopied'))
			window.setTimeout(() => setCopied(false), 2000)
		} else if (result === 'unsupported' || result === 'failed') {
			onManualShareTextChange(text)
			toast.warning(
				result === 'unsupported'
					? t('shareCopyUnsupported')
					: t('shareCopyFailed')
			)
		}
	}, [locale, match, onManualShareTextChange, t])

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
