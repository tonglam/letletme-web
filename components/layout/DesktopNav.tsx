'use client'

import { ReportProblemEntry } from '@/components/feedback/ReportProblemEntry'
import {
	HeaderProfileCard,
	type NavigationUser
} from '@/components/profile/HeaderProfileCard'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Link } from '@/i18n/navigation'
import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { menuItems } from './config'

export function DesktopNav({ user }: { user: NavigationUser | null }) {
	const t = useTranslations('Navigation')

	return (
		<div className="ml-6 hidden items-center gap-0.5 md:flex">
			{menuItems.map(item => (
				item.directHref ? (
					<Button
						key={item.id}
						variant="ghost"
						className="px-3 font-display text-xs font-semibold uppercase tracking-caps text-fascia-foreground/70 hover:bg-fascia-foreground/5 hover:text-fascia-foreground focus-visible:ring-electric"
						asChild
					>
						<Link href={item.directHref} prefetch={false}>
							{t(item.labelKey)}
						</Link>
					</Button>
				) : (
				<DropdownMenu key={item.id}>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							className="px-3 font-display text-xs font-semibold uppercase tracking-caps text-fascia-foreground/70 hover:bg-fascia-foreground/5 hover:text-fascia-foreground focus-visible:ring-electric data-[state=open]:text-fascia-foreground"
						>
							{t(item.labelKey)}
							<ChevronDown
								data-icon="inline-end"
								className="opacity-60"
							/>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuGroup>
							{item.items.map(subItem => (
								<DropdownMenuItem
									key={subItem.labelKey}
									asChild
								>
									<Link
										href={subItem.href}
										prefetch={false}
									>
										{t(subItem.labelKey)}
									</Link>
								</DropdownMenuItem>
							))}
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
				)
			))}

			{user ? (
				<HeaderProfileCard user={user} />
			) : (
				<>
					<ReportProblemEntry triggerClassName="px-3 text-sm text-fascia-foreground/70 hover:text-fascia-foreground" />
					<Button
						size="sm"
						className="ml-2 font-display text-xs font-semibold uppercase tracking-caps shadow-sticker-sm transition-transform hover:-translate-y-px"
						asChild
					>
						<Link
							href="/auth/login"
							prefetch={false}
						>
							{t('login')}
						</Link>
					</Button>
				</>
			)}
		</div>
	)
}
