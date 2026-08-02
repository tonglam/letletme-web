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
import { Link } from '@/i18n/navigation'
import { ChevronDown, UserCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { menuItems } from './config'

export function DesktopNav({ user }: { user: NavigationUser | null }) {
	const t = useTranslations('Navigation')

	return (
		<div className="ml-6 hidden items-center gap-1 md:flex">
			{menuItems.map(item => (
				<DropdownMenu key={item.id}>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="px-2.5">
							<item.icon data-icon="inline-start" />
							{t(item.labelKey)}
							<ChevronDown data-icon="inline-end" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuGroup>
							{item.items.map(subItem => (
								<DropdownMenuItem key={subItem.labelKey} asChild>
									<Link href={subItem.href}>{t(subItem.labelKey)}</Link>
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
						{t('login')}
					</Link>
				</Button>
			)}
		</div>
	)
}
