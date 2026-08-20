'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Camera } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

export function AvatarUpload({
	name,
	email,
	image,
}: {
	name: string | null | undefined
	email: string | null | undefined
	image: string | null | undefined
}) {
	const t = useTranslations('Profile')
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [uploading, setUploading] = useState(false)
	const [preview, setPreview] = useState<string | null>(null)

	const initials = (name ?? email ?? '?').charAt(0).toUpperCase()
	const src = preview ?? image ?? undefined

	const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return
		e.target.value = ''

		// Optimistic local preview while uploading
		const localUrl = URL.createObjectURL(file)
		setPreview(localUrl)
		setUploading(true)

		try {
			const formData = new FormData()
			formData.set('avatar', file)
			const response = await fetch('/api/profile/avatar', {
				method: 'POST',
				body: formData,
				credentials: 'include'
			})
			const result = (await response.json().catch(() => null)) as {
				success?: boolean
				errorCode?: string
				imageUrl?: string
			} | null
			const errorCode = response.ok && result?.success
				? undefined
				: result?.errorCode ?? 'uploadFailed'
			const imageUrl = result?.imageUrl

			if (errorCode) {
				const message =
					errorCode === 'notAuthenticated'
						? t('errors.notAuthenticated')
						: errorCode === 'forbidden'
							? t('errors.forbidden')
							: errorCode === 'noFile'
								? t('errors.noFile')
								: errorCode === 'fileTooLarge'
									? t('errors.fileTooLarge')
									: errorCode === 'invalidFile'
									? t('errors.invalidFile')
									: errorCode === 'rateLimited'
									? t('errors.rateLimited')
									: t('errors.uploadFailed')
				toast.error(message)
				setPreview(null)
			} else {
				toast.success(t('avatarUpdated'))
				setPreview(imageUrl ?? null)
			}
		} catch {
			toast.error(t('avatarFailed'))
			setPreview(null)
		} finally {
			URL.revokeObjectURL(localUrl)
			setUploading(false)
		}
	}

	return (
		<div className="flex flex-col items-center gap-3">
			<input
				ref={fileInputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				className="hidden"
				onChange={handleChange}
			/>

			<button
				type="button"
				className="relative group rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				onClick={() => fileInputRef.current?.click()}
				disabled={uploading}
				title={t('changeAvatar')}
			>
				<Avatar className="h-24 w-24">
					<AvatarImage src={src} alt={name ?? ''} />
					<AvatarFallback className="text-2xl bg-primary/10 text-primary-ink">
						{initials}
					</AvatarFallback>
				</Avatar>
				<div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity flex items-center justify-center">
					{uploading ? (
						<div className="h-5 w-5 border-2 border-fascia-foreground border-t-transparent rounded-full animate-spin" />
					) : (
						<Camera className="h-5 w-5 text-fascia-foreground" />
					)}
				</div>
			</button>

			<p className="text-xs text-muted-foreground">{t('clickAvatar')}</p>
		</div>
	)
}
