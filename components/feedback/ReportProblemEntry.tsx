'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet'
import { collectBrowserBugReportMeta } from '@/lib/bug-report-diagnostics'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

const BODY_MIN = 8
const SCREENSHOT_MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_SCREENSHOT_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif',
])

export function ReportProblemEntry({
	children,
	className,
	triggerClassName,
	onOpenChange,
}: {
	children?: ReactNode
	className?: string
	triggerClassName?: string
	onOpenChange?: (open: boolean) => void
}) {
	const t = useTranslations('ReportProblem')
	const [open, setOpen] = useState(false)
	const [body, setBody] = useState('')
	const [file, setFile] = useState<File | null>(null)
	const [submitting, setSubmitting] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen)
		onOpenChange?.(nextOpen)
	}

	const handleSubmit = async () => {
		if (body.trim().length < BODY_MIN) {
			toast.error(t('tooShort'))
			return
		}
		if (file && file.size > SCREENSHOT_MAX_BYTES) {
			toast.error(t('screenshotTooLarge'))
			return
		}
		if (file && file.type && !ALLOWED_SCREENSHOT_TYPES.has(file.type)) {
			toast.error(t('screenshotUnsupported'))
			return
		}
		setSubmitting(true)
		try {
			let screenshotBase64: string | null = null
			let screenshotMime: string | null = null
			if (file) {
				const buffer = await file.arrayBuffer()
				const bytes = new Uint8Array(buffer)
				let binary = ''
				for (const byte of bytes) binary += String.fromCharCode(byte)
				screenshotBase64 = btoa(binary)
				screenshotMime = file.type || 'image/jpeg'
			}

			const response = await fetch('/api/bug-reports', {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					body,
					clientMeta: collectBrowserBugReportMeta(),
					screenshotBase64,
					screenshotMime,
				}),
			})
			const result = (await response.json()) as {
				success?: boolean
				publicId?: string
				error?: string
			}
			if (!response.ok || !result.success || !result.publicId) {
				toast.error(result.error || t('failed'))
				return
			}
			toast.success(t('received', { id: result.publicId }))
			setBody('')
			setFile(null)
			if (fileInputRef.current) fileInputRef.current.value = ''
			handleOpenChange(false)
		} catch {
			toast.error(t('failed'))
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<Sheet open={open} onOpenChange={handleOpenChange}>
			<SheetTrigger asChild>
				{children ?? (
					<button type="button" className={cn(triggerClassName)}>
						{t('entry')}
					</button>
				)}
			</SheetTrigger>
			<SheetContent side="right" className={cn('z-[60] sm:max-w-md', className)}>
				<SheetHeader>
					<SheetTitle>{t('title')}</SheetTitle>
					<SheetDescription>{t('description')}</SheetDescription>
				</SheetHeader>
				<div className="mt-6 space-y-4">
					<div className="space-y-2">
						<Label htmlFor="bug-report-body">{t('label')}</Label>
						<textarea
							id="bug-report-body"
							value={body}
							onChange={event => setBody(event.target.value)}
							placeholder={t('placeholder')}
							maxLength={500}
							rows={6}
							className="flex min-h-[9rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="bug-report-shot">{t('screenshotLabel')}</Label>
						<input
							ref={fileInputRef}
							id="bug-report-shot"
							type="file"
							accept="image/jpeg,image/png,image/webp,image/gif"
							onChange={event => setFile(event.target.files?.[0] ?? null)}
							className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
						/>
					</div>
					<Button
						type="button"
						className="w-full"
						disabled={submitting}
						onClick={() => void handleSubmit()}
					>
						{submitting ? t('sending') : t('submit')}
					</Button>
				</div>
			</SheetContent>
		</Sheet>
	)
}
