'use client'

import { Button } from '@/components/ui/button'
import {
	copyElementImageToClipboard,
	shareElementImage,
	shareText,
	type ShareResult
} from '@/lib/share/clipboard'
import { Check, ImageIcon, Share2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useRef, useState, type RefObject } from 'react'
import { toast } from 'sonner'
import { ShareTextFallback } from './ShareTextFallback'

type ShareTextValue = string | (() => string)

export function ShareActions({
	text,
	imageRef,
	title,
	className,
	compact = false,
	disabled = false
}: {
	text: ShareTextValue
	imageRef?: RefObject<HTMLElement | null>
	title?: string
	className?: string
	compact?: boolean
	disabled?: boolean
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
			if (result === 'unsupported') toast.warning(t('shareUnsupported'))
			else if (result === 'failed') toast.warning(t('shareFailed'))
		},
		[t]
	)

	const handleTextShare = useCallback(async () => {
		const value = resolveText()
		const result = await shareText(value, { title })
		if (result === 'shared') {
			setManualShareText(null)
			setTextShared(true)
			toast.success(t('shareTextShared'))
			window.setTimeout(() => setTextShared(false), 2000)
			return
		}
		if (result === 'copied') {
			setManualShareText(null)
			setTextShared(true)
			toast.success(t('shareTextCopied'))
			window.setTimeout(() => setTextShared(false), 2000)
			return
		}
		if (result === 'unsupported' || result === 'failed') {
			setManualShareText(value)
			reportFailure(result)
		}
	}, [reportFailure, resolveText, t, title])

	const handleImageShare = useCallback(async () => {
		const element = imageRef?.current
		if (!element || imageShareInFlight.current) return
		imageShareInFlight.current = true
		try {
			const result = await shareElementImage(element)
			if (result === 'shared') {
				setImageShared(true)
				toast.success(t('shareImageShared'))
				window.setTimeout(() => setImageShared(false), 2000)
				return
			}
			if (result === 'copied') {
				setImageShared(true)
				toast.success(t('shareImageCopied'))
				window.setTimeout(() => setImageShared(false), 2000)
				return
			}
			if (result === 'unsupported' || result === 'failed') reportFailure(result)
		} finally {
			imageShareInFlight.current = false
		}
	}, [imageRef, reportFailure, t])

	return (
		<div
			className={className ?? 'flex flex-wrap items-center gap-2'}
			data-share-exclude="true"
		>
			<Button
				type="button"
				variant="outline"
				size={compact ? 'icon' : 'sm'}
				className={compact ? 'size-8' : 'gap-1.5'}
				onClick={() => void handleTextShare()}
				disabled={disabled}
				aria-label={t('shareText')}
				title={compact ? t('shareText') : undefined}
			>
				{textShared ? (
					<Check
						data-icon="inline-start"
						className="text-primary-ink"
					/>
				) : (
					<Share2 data-icon="inline-start" />
				)}
				{compact ? (
					<span className="sr-only">{t('shareText')}</span>
				) : textShared ? (
					t('shareDone')
				) : (
					t('shareText')
				)}
			</Button>
			{imageRef ? (
				<Button
					type="button"
					variant="outline"
					size={compact ? 'icon' : 'sm'}
					className={compact ? 'size-8' : 'gap-1.5'}
					onClick={() => void handleImageShare()}
					disabled={disabled}
					aria-label={t('shareImage')}
					title={compact ? t('shareImage') : undefined}
				>
					{imageShared ? (
						<Check
							data-icon="inline-start"
							className="text-primary-ink"
						/>
					) : (
						<ImageIcon data-icon="inline-start" />
					)}
					{compact ? (
						<span className="sr-only">{t('shareImage')}</span>
					) : imageShared ? (
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
