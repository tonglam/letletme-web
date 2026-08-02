'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOut } from '@/lib/auth-client'
import { getVerifiedFplEntryId } from '@/lib/fpl-binding-core'
import { Link, useRouter } from '@/i18n/navigation'
import { LogOut, Settings, Trophy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

export interface NavigationUser {
	name?: string | null
	email: string
	image?: string | null
	fplEntryId?: number | null
	fplEntryVerifiedAt?: Date | string | null
	fplTeamName?: string | null
	fplManagerName?: string | null
}

export function HeaderProfileCard({ user }: { user: NavigationUser }) {
	const router = useRouter()
	const t = useTranslations('Navigation')
	const [signingOut, setSigningOut] = useState(false)
	const initials = (user.name ?? user.email).charAt(0).toUpperCase()
	const verifiedEntryId = getVerifiedFplEntryId(user)

	const handleSignOut = async () => {
		setSigningOut(true)
		try {
			await signOut()
			router.push('/')
			router.refresh()
		} finally {
			setSigningOut(false)
		}
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					className="h-9 gap-2 px-2"
					aria-label={t('openAccountMenu', { name: user.name ?? user.email })}
				>
					<Avatar className="h-6 w-6">
						<AvatarImage src={user.image ?? undefined} alt={user.name ?? ''} />
						<AvatarFallback className="text-xs bg-primary/10 text-primary-ink">
							{initials}
						</AvatarFallback>
					</Avatar>
					<span className="max-w-[120px] truncate text-sm hidden lg:inline">
						{user.name ?? user.email}
					</span>
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent align="end" className="w-64 p-0" sideOffset={8}>
				{/* Profile header */}
				<div className="p-4 flex gap-3 items-center">
					<Avatar className="h-10 w-10 shrink-0">
						<AvatarImage src={user.image ?? undefined} alt={user.name ?? ''} />
						<AvatarFallback className="bg-primary/10 text-primary-ink">
							{initials}
						</AvatarFallback>
					</Avatar>
					<div className="flex-1 min-w-0">
						<p className="font-semibold text-sm leading-tight truncate">
							{user.name ?? '—'}
							{verifiedEntryId !== null ? (
								<span className="font-normal text-muted-foreground ml-1">
									#{verifiedEntryId}
								</span>
							) : null}
						</p>
						<p className="text-xs text-muted-foreground truncate mt-0.5">
							{user.email}
						</p>
						{verifiedEntryId !== null && user.fplTeamName ? (
							<p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground truncate">
								<Trophy aria-hidden="true" className="size-3 shrink-0 text-primary-ink" />
								<span className="truncate">
									{user.fplTeamName}
									{user.fplManagerName ? ` · ${user.fplManagerName}` : ''}
								</span>
							</p>
						) : null}
					</div>
				</div>

				<DropdownMenuSeparator />

				<div className="p-1">
					<DropdownMenuItem asChild>
						<Link href="/profile" className="cursor-pointer">
							<Settings className="h-4 w-4 mr-2" />
							{t('profileSettings')}
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={handleSignOut}
						disabled={signingOut}
						className="text-destructive focus:text-destructive cursor-pointer"
					>
						<LogOut className="h-4 w-4 mr-2" />
						{signingOut ? t('signingOut') : t('signOut')}
					</DropdownMenuItem>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
