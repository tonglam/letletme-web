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
import { signOut, useSession } from '@/lib/auth-client'
import { LogOut, Settings } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function HeaderProfileCard() {
	const { data: session } = useSession()
	const router = useRouter()
	const [signingOut, setSigningOut] = useState(false)

	if (!session) return null

	const { user } = session
	const initials = (user.name ?? user.email).charAt(0).toUpperCase()

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
				<Button variant="ghost" className="px-2 gap-2 h-9">
					<Avatar className="h-6 w-6">
						<AvatarImage src={user.image ?? undefined} alt={user.name ?? ''} />
						<AvatarFallback className="text-xs bg-primary/10 text-primary">
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
						<AvatarFallback className="bg-primary/10 text-primary">
							{initials}
						</AvatarFallback>
					</Avatar>
					<div className="flex-1 min-w-0">
						<p className="font-semibold text-sm leading-tight truncate">
							{user.name ?? '—'}
							{user.fplEntryId && (
								<span className="font-normal text-muted-foreground ml-1">
									#{user.fplEntryId}
								</span>
							)}
						</p>
						<p className="text-xs text-muted-foreground truncate mt-0.5">
							{user.email}
						</p>
					</div>
				</div>

				<DropdownMenuSeparator />

				<div className="p-1">
					<DropdownMenuItem asChild>
						<Link href="/profile" className="cursor-pointer">
							<Settings className="h-4 w-4 mr-2" />
							Profile settings
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={handleSignOut}
						disabled={signingOut}
						className="text-destructive focus:text-destructive cursor-pointer"
					>
						<LogOut className="h-4 w-4 mr-2" />
						{signingOut ? 'Signing out…' : 'Sign out'}
					</DropdownMenuItem>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
