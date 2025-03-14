'use client'

import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { ChevronDown, Globe, UserCircle } from 'lucide-react'
import Link from 'next/link'
import { menuItems } from './config'

interface DesktopNavProps {
	currentLang: string
	setCurrentLang: (lang: string) => void
	languages: { code: string; label: string }[]
}

export function DesktopNav({
	currentLang,
	setCurrentLang,
	languages
}: DesktopNavProps) {
	return (
		<div className="hidden md:flex items-center space-x-2 ml-8">
			{menuItems.map(item => (
				<DropdownMenu key={item.id}>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							className="px-2"
						>
							<item.icon className="h-5 w-5 mr-2" />
							{item.label}
							<ChevronDown className="ml-2 h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						{item.items.map(subItem => (
							<DropdownMenuItem
								key={subItem.label}
								asChild={!!subItem.href}
							>
								{subItem.href ? (
									<Link href={subItem.href}>{subItem.label}</Link>
								) : (
									subItem.label
								)}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			))}

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
					>
						<Globe className="h-5 w-5" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					{languages.map(lang => (
						<DropdownMenuItem
							key={lang.code}
							className={cn(
								'cursor-pointer',
								currentLang === lang.code && 'bg-accent'
							)}
							onClick={() => setCurrentLang(lang.code)}
						>
							{lang.label}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>

			<Button
				variant="ghost"
				className="px-2"
				asChild
			>
				<Link href="/auth/login">
					<UserCircle className="h-5 w-5 mr-2" />
					Login
				</Link>
			</Button>
		</div>
	)
}
