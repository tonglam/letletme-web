'use client'

import { copyTextToClipboard } from '@/app/live/points/_lib/live-points-share'
import { Button } from '@/components/ui/button'
import { localizePathname, type AppLocale } from '@/i18n/routing'
import { shareElementImage } from '@/lib/share/clipboard'
import type { Match } from '@/types/match'
import { Check, Copy, ImageIcon } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useRef, useState, type RefObject } from 'react'
import { toast } from 'sonner'
import { formatMatchShareText } from './match-share'

export function MatchShareButton({
	match,
	onManualShareTextChange,
	imageRef,
}: {
	match: Match
	onManualShareTextChange: (text: string | null) => void
	imageRef: RefObject<HTMLElement | null>
}) {
	const t = useTranslations('LiveMatches')
	const shareT = useTranslations('Share')
	const locale = useLocale() as AppLocale
	const [copied, setCopied] = useState(false)
	const [imageShared, setImageShared] = useState(false)
	const imageShareInFlight = useRef(false)

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

	const handleImageShare = useCallback(async () => {
		const element = imageRef.current
		if (!element || imageShareInFlight.current) return
		imageShareInFlight.current = true
		try {
			const result = await shareElementImage(element)
			if (result === 'shared') {
				setImageShared(true)
				toast.success(shareT('shareImageShared'))
				window.setTimeout(() => setImageShared(false), 2000)
			} else if (result === 'copied') {
				setImageShared(true)
				toast.success(shareT('shareImageCopied'))
				window.setTimeout(() => setImageShared(false), 2000)
			} else if (result === 'unsupported') {
				toast.warning(shareT('shareUnsupported'))
			} else {
				toast.warning(shareT('shareFailed'))
			}
		} finally {
			imageShareInFlight.current = false
		}
	}, [imageRef, shareT])

	return (
		<div className="flex items-center gap-1.5">
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
			<Button
				type="button"
				variant="outline"
				size="icon"
				className="size-8 rounded-full border-border/70 bg-card/90 shadow-sm backdrop-blur-sm hover:bg-accent"
				onClick={() => void handleImageShare()}
				aria-label={shareT('shareImage')}
				title={shareT('shareImage')}
			>
				{imageShared ? (
					<Check className="size-3.5 text-primary-ink" aria-hidden="true" />
				) : (
					<ImageIcon className="size-3.5" aria-hidden="true" />
				)}
			</Button>
		</div>
	)
}
