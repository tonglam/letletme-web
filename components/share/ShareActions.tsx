'use client'

import { Button } from '@/components/ui/button'
import {
	copyElementImageToClipboard,
	shareElementImage,
	shareText,
	type ShareResult
} from '@/lib/share/clipboard'
import { cn } from '@/lib/utils'
import { Check, ImageIcon, Share2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useRef, useState, type RefObject } from 'react'
import { ShareTextFallback } from './ShareTextFallback'
import { notifyShareSuccess, notifyShareWarning } from './share-notification'

type ShareTextValue = string | (() => string)
type ShareActionKind = 'text' | 'image'

export function ShareActions({
	text,
	imageRef,
	imageTargetId,
	title,
	className,
	buttonClassName,
	disabled = false,
	actions = ['text', 'image'] as ShareActionKind[]
}: {
	text: ShareTextValue
	imageRef?: RefObject<HTMLElement | null>
	imageTargetId?: string
	title?: string
	className?: string
	buttonClassName?: string
	disabled?: boolean
	actions?: ShareActionKind[]
}) {
	const t = useTranslations('Share')
	const [textShared, setTextShared] = useState(false)
	const [imageShared, setImageShared] = useState(false)
	const [manualShareText, setManualShareText] = useState<string | null>(null)
	const imageShareInFlight = useRef(false)

	const resolveText = useCallback(
		() => (typeof text === 'function' ? text() : text),
		[text]
	)

	const reportFailure = useCallback(
		(result: ShareResult) => {
			if (result === 'unsupported') notifyShareWarning(t('shareUnsupported'))
			else if (result === 'failed') notifyShareWarning(t('shareFailed'))
		},
		[t]
	)

	const handleTextShare = useCallback(async () => {
		const value = resolveText().trim()
		if (!value) {
			notifyShareWarning(t('shareUnavailable'))
			return
		}
		const result = await shareText(value, { title })
		if (result === 'shared') {
			setManualShareText(null)
			setTextShared(true)
			notifyShareSuccess(t('shareTextShared'))
			window.setTimeout(() => setTextShared(false), 2000)
			return
		}
		if (result === 'copied') {
			setManualShareText(null)
			setTextShared(true)
			notifyShareSuccess(t('shareTextCopied'))
			window.setTimeout(() => setTextShared(false), 2000)
			return
		}
		if (result === 'unsupported' || result === 'failed') {
			setManualShareText(value)
			reportFailure(result)
		}
	}, [reportFailure, resolveText, t, title])

	const handleImageShare = useCallback(async () => {
		const element =
			imageRef?.current ??
			(imageTargetId ? document.getElementById(imageTargetId) : null)
		if (!element) {
			notifyShareWarning(t('shareUnavailable'))
			return
		}
		if (imageShareInFlight.current) return
		imageShareInFlight.current = true
		try {
			const result = await shareElementImage(element)
			if (result === 'shared') {
				setImageShared(true)
				notifyShareSuccess(t('shareImageShared'))
				window.setTimeout(() => setImageShared(false), 2000)
				return
			}
			if (result === 'copied') {
				setImageShared(true)
				notifyShareSuccess(t('shareImageCopied'))
				window.setTimeout(() => setImageShared(false), 2000)
				return
			}
			if (result === 'unsupported' || result === 'failed') reportFailure(result)
		} finally {
			imageShareInFlight.current = false
		}
	}, [imageRef, imageTargetId, reportFailure, t])

	return (
		<div
			className={className ?? 'flex flex-wrap items-center gap-2'}
			data-share-exclude="true"
		>
			{actions.includes('text') ? (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className={cn(
						'h-9 shrink-0 gap-1.5 rounded-md px-3',
						buttonClassName
					)}
					onClick={() => void handleTextShare()}
					disabled={disabled}
					aria-label={t('shareText')}
				>
					{textShared ? (
						<Check
							data-icon="inline-start"
							className="text-primary-ink"
						/>
					) : (
						<Share2 data-icon="inline-start" />
					)}
					{textShared ? (
						t('shareDone')
					) : (
						t('shareText')
					)}
				</Button>
			) : null}
			{(imageRef || imageTargetId) && actions.includes('image') ? (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className={cn(
						'h-9 shrink-0 gap-1.5 rounded-md px-3',
						buttonClassName
					)}
					onClick={() => void handleImageShare()}
					disabled={disabled}
					aria-label={t('shareImage')}
				>
					{imageShared ? (
						<Check
							data-icon="inline-start"
							className="text-primary-ink"
						/>
					) : (
						<ImageIcon data-icon="inline-start" />
					)}
					{imageShared ? (
						t('shareDone')
					) : (
						t('shareImage')
					)}
				</Button>
			) : null}
			{manualShareText ? (
				<ShareTextFallback
					text={manualShareText}
					message={t('shareUnsupported')}
					fieldLabel={t('shareManualLabel')}
					closeLabel={t('shareClose')}
					onClose={() => setManualShareText(null)}
				/>
			) : null}
		</div>
	)
}

// Keep the image clipboard helper discoverable for pages that need a custom
// image action while the unified component handles the common path.
export { copyElementImageToClipboard }
