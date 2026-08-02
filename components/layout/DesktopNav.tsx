'use client'

import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { HeaderProfileCard, type NavigationUser } from '@/components/profile/HeaderProfileCard'
import { ChevronDown, UserCircle } from 'lucide-react'
import Link from 'next/link'
import { menuItems } from './config'

export function DesktopNav({ user }: { user: NavigationUser | null }) {
	return (
		<div className="ml-6 hidden items-center gap-1 md:flex">
			{menuItems.map(item => (
				<DropdownMenu key={item.id}>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="px-2.5">
							<item.icon data-icon="inline-start" />
							{item.label}
							<ChevronDown data-icon="inline-end" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuGroup>
							{item.items.map(subItem => (
								<DropdownMenuItem key={subItem.label} asChild>
									<Link href={subItem.href}>{subItem.label}</Link>
								</DropdownMenuItem>
							))}
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			))}

			{user ? (
				<HeaderProfileCard user={user} />
			) : (
				<Button variant="ghost" className="px-2" asChild>
					<Link href="/auth/login">
						<UserCircle data-icon="inline-start" />
						Login
					</Link>
				</Button>
			)}
		</div>
	)
}
