'use client'

import { GameweekBadge } from '@/components/stats/GameweekBadge'
import { CountdownCard } from '@/components/home/CountdownCard'
import { ShareActions } from '@/components/share/ShareActions'
import { usePageActive } from '@/hooks/use-page-active'
import { useRouter } from '@/i18n/navigation'
import { homeDeadlineRefreshDelayMs, type TimeLeft } from '@/lib/home-deadline'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'

interface DeadlineSectionProps {
	nextEventId: number | null
	deadlineTime: string | null
	initialTimeLeft: TimeLeft
	bootstrapFailed: boolean
}

type DeadlineSchedule = {
	nextEventId: number
	deadlineTime: string
	initialTimeLeft: TimeLeft
}

export function DeadlineSection({
	nextEventId,
	deadlineTime,
	initialTimeLeft,
	bootstrapFailed
}: DeadlineSectionProps) {
	const t = useTranslations('Home')
	const incomingSchedule = useMemo<DeadlineSchedule | null>(
		() =>
			nextEventId && deadlineTime
				? { nextEventId, deadlineTime, initialTimeLeft }
				: null,
		[deadlineTime, initialTimeLeft, nextEventId]
	)
	const [lastValidSchedule, setLastValidSchedule] =
		useState<DeadlineSchedule | null>(incomingSchedule)
	const effectiveSchedule =
		incomingSchedule ?? (bootstrapFailed ? lastValidSchedule : null)
	const effectiveDeadlineTime = effectiveSchedule?.deadlineTime ?? null
	const effectiveNextEventId = effectiveSchedule?.nextEventId ?? null
	const deadline = useMemo(
		() => (effectiveDeadlineTime ? new Date(effectiveDeadlineTime) : null),
		[effectiveDeadlineTime]
	)
	const router = useRouter()
	const routerRef = useRef(router)
	const refreshCount = useRef(0)
	const refreshDeadline = useRef<string | null>(effectiveDeadlineTime)
	const isPageActive = usePageActive()
	const shareRef = useRef<HTMLDivElement | null>(null)
	// CountdownCard renders data-share-preserve-width="true" on the share root.

	useEffect(() => {
		if (incomingSchedule) {
			setLastValidSchedule(current =>
				current === incomingSchedule ? current : incomingSchedule
			)
		} else if (!bootstrapFailed) {
			setLastValidSchedule(null)
		}
	}, [bootstrapFailed, incomingSchedule])

	useEffect(() => {
		routerRef.current = router
	}, [router])

	useEffect(() => {
		if (refreshDeadline.current !== effectiveDeadlineTime) {
			refreshDeadline.current = effectiveDeadlineTime
			refreshCount.current = 0
		}
		if (!deadline) return

		// The revision publisher can advance after the nominal deadline. Keep checking
		// while the page is active, with an interval capped at five minutes, so a slow
		// publication cannot leave the page permanently pinned to the expired event.
		let expireTimer: number | undefined
		let refreshTimer: number | undefined

		const startRefreshing = () => {
			const refresh = () => {
				refreshCount.current += 1
				routerRef.current.refresh()
				refreshTimer = window.setTimeout(
					refresh,
					homeDeadlineRefreshDelayMs(refreshCount.current)
				)
			}
			refresh()
		}

		const msUntilDeadline = deadline.getTime() - Date.now()
		if (isPageActive) {
			if (msUntilDeadline <= 0) {
				startRefreshing()
			} else {
				expireTimer = window.setTimeout(startRefreshing, msUntilDeadline + 500)
			}
		}

		return () => {
			if (expireTimer !== undefined) window.clearTimeout(expireTimer)
			if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
		}
	}, [deadline, effectiveDeadlineTime, isPageActive])

	if (!effectiveNextEventId || !effectiveDeadlineTime) {
		return (
			<CountdownCard
				ref={shareRef}
				eyebrow={t('nextDeadline')}
				title={t('scheduleUnavailable')}
				deadlineTime={null}
				initialTimeLeft={initialTimeLeft}
				deadlinePrefix={t('deadlinePrefix')}
				noDeadlineLabel={t('scheduleUnavailableDescription')}
				unitLabels={{
					days: t('days'),
					hours: t('hours'),
					minutes: t('minutes'),
					seconds: t('seconds')
				}}
				headerAction={
					<ShareActions
						actions={['image']}
						text={t('nextDeadline')}
						imageRef={shareRef}
						title={t('nextDeadline')}
						buttonClassName="text-primary-ink hover:text-primary-ink"
						compact
					/>
				}
			/>
		)
	}

	return (
		<CountdownCard
			ref={shareRef}
			eyebrow={t('nextDeadline')}
			title={t('gameweek', { number: effectiveNextEventId })}
			deadlineTime={effectiveDeadlineTime}
			initialTimeLeft={effectiveSchedule?.initialTimeLeft ?? initialTimeLeft}
			deadlinePrefix={t('deadlinePrefix')}
			noDeadlineLabel={t('scheduleUnavailableDescription')}
			unitLabels={{
				days: t('days'),
				hours: t('hours'),
				minutes: t('minutes'),
				seconds: t('seconds')
			}}
			expiredBadge={t('liveTag')}
			expiredLabel={t('inProgress')}
			headerAction={
				<div
					className="flex items-center gap-2"
					data-share-deadline-actions="true"
				>
					<ShareActions
						actions={['image']}
						text={t('nextDeadline')}
						imageRef={shareRef}
						title={t('nextDeadline')}
						buttonClassName="text-primary-ink hover:text-primary-ink"
						compact
					/>
					<span className="inline-flex items-center gap-2">
						<span
							className="live-dot"
							aria-hidden="true"
						/>
						<GameweekBadge
							gameweek={effectiveNextEventId}
							size="sm"
							fontFamily="display"
						/>
					</span>
				</div>
			}
		/>
	)
}
