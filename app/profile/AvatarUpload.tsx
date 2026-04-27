'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Camera } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { updateAvatar } from './avatar-actions'

export function AvatarUpload({
	name,
	email,
	image,
}: {
	name: string | null | undefined
	email: string
	image: string | null | undefined
}) {
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [uploading, setUploading] = useState(false)
	const [preview, setPreview] = useState<string | null>(null)

	const initials = (name ?? email).charAt(0).toUpperCase()
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
			const { error, imageUrl } = await updateAvatar(formData)

			if (error) {
				toast.error(error)
				setPreview(null)
			} else {
				toast.success('Avatar updated')
				setPreview(imageUrl ?? null)
			}
		} catch {
			toast.error('Failed to update avatar')
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
				accept="image/*"
				className="hidden"
				onChange={handleChange}
			/>

			<button
				type="button"
				className="relative group rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				onClick={() => fileInputRef.current?.click()}
				disabled={uploading}
				title="Change avatar"
			>
				<Avatar className="h-24 w-24">
					<AvatarImage src={src} alt={name ?? ''} />
					<AvatarFallback className="text-2xl bg-primary/10 text-primary">
						{initials}
					</AvatarFallback>
				</Avatar>
				<div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity flex items-center justify-center">
					{uploading ? (
						<div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
					) : (
						<Camera className="h-5 w-5 text-white" />
					)}
				</div>
			</button>

			<p className="text-xs text-muted-foreground">Click to change avatar</p>
		</div>
	)
}
