'use client'

import { DarkModeButton } from '@/components/button/DarkModeButton'
import { EntryButton } from '@/components/button/EntryButton'
import { GithubIcon } from '@/components/button/GithubIcon'
import { LogoIcon } from '@/components/button/LogoIcon'
import { DropdownNavBar } from '@/components/navbar/DropdownNavBar'
import { NavBar } from '@/components/navbar/NavBar'

function Header() {
	return (
		<nav className="flex w-full h-14 top-0 left-0 shadow-sm items-center justify-between pr-4 lg:px-16">
			<div className="flex pl-2 md:hidden">
				<DropdownNavBar />
			</div>
			<div className="w-1/2">
				<LogoIcon />
			</div>
			<div className="hidden md:flex ml-12">
				<NavBar />
			</div>
			<div className="flex items-center cursor-pointer">
				<DarkModeButton />
			</div>
			<div className="hidden md:flex">
				<GithubIcon />
				<EntryButton />
			</div>
		</nav>
	)
}

export { Header }
