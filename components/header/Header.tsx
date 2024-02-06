'use client'

import DarkModeIcon from '@/components/iconButton/DarkMode'
import UserIcon from '@/components/iconButton/Entry'
import GithubIcon from '@/components/iconButton/Github'
import Logo from '@/components/iconButton/Logo'
import NavBar from '@/components/navbar/NavBar'
import NavSideBar from '@/components/navbar/NavSideBar'
import { Cross2Icon } from '@radix-ui/react-icons'
import { useState } from 'react'
import { AiOutlineMenu } from 'react-icons/ai'

export const Header = () => {
	const [openNav, setOpenNav] = useState(false)

	const handleNav = () => {
		setOpenNav(!openNav)
	}

	return (
		<nav className="flex w-full h-14 top-0 left-0 shadow-sm items-center justify-between pr-4 md:px-12">
			<div className="w-1/2">
				<Logo />
			</div>
			<div className="hidden md:flex ml-12">
				<NavBar />
			</div>
			<div className="flex items-center">
				<div className="flex cursor-pointer">
					<GithubIcon />
					<DarkModeIcon />
					<UserIcon />
				</div>
				<div
					className="flex ml-4"
					onClick={handleNav}
				>
					<AiOutlineMenu size={25} />
				</div>
			</div>
			{/* mobile side navigation */}
			<div
				className={
					openNav
						? 'absolute left-0 top-0 w-[60%] h-full bg-emerald-500 text-white ease-in-out duration-500'
						: 'absolute left-[-100%] top-0 bottom-0 w-full ease-in-out duration-500'
				}
			>
				{openNav}
				<div
					className="absolute top-2 right-2 cursor-pointer"
					onClick={handleNav}
				>
					<Cross2Icon className="h-[1.2rem] w-[1.2rem]" />
				</div>
				<div className="flex flex-col uppercase pt-24">
					<NavSideBar />
				</div>
			</div>
		</nav>
	)
}
