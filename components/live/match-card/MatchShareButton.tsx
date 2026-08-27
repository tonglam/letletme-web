'use client'

import { ShareActions } from '@/components/share/ShareActions'
import { localizePathname, type AppLocale } from '@/i18n/routing'
import type { Match } from '@/types/match'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, type RefObject } from 'react'
import { formatMatchShareText } from './match-share'

export function MatchShareButton({
	match,
	imageRef,
}: {
	match: Match
	imageRef: RefObject<HTMLElement | null>
}) {
	const t = useTranslations('LiveMatches')
	const locale = useLocale() as AppLocale
	const shareText = useCallback(() => {
		const origin =
			typeof window !== 'undefined'
				? window.location.origin
				: 'https://letletme.top'
		const shareUrl = new URL(
			localizePathname('/live/matches', locale),
			origin,
		).toString()

		return formatMatchShareText(match, {
			liveMinute: minute => t('liveMinute', { minute }),
			halfTime: t('halfTime'),
			fullTime: t('fullTime'),
			provisional: t('fullTime'),
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
	}, [locale, match, t])

	return (
		<ShareActions
			text={shareText}
			imageRef={imageRef}
			title={`${match.homeTeam.shortName} – ${match.awayTeam.shortName}`}
			className="flex flex-wrap items-center justify-end gap-2"
		/>
	)
}
