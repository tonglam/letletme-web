'use client';

import { DarkModeIcon } from '@/components/icons/DarkMode';
import { GithubIcon } from '@/components/icons/Github';
import { LogoIcon } from '@/components/icons/Logo';
import { NavMenu } from '@/components/navbar/NavBar';
import { useState } from 'react';
import { AiOutlineClose, AiOutlineMenu } from 'react-icons/ai';
import { EntryIcon } from '../icons/Entry';

const Navbar = () => {
	const [open, setOpen] = useState(false);

	const handleNav = () => {
		setOpen(!open);
	};

	return (
		<nav className="fixed w-full h-20 top-0 left-0 shadow-sm">
			<div className="flex justify-between p-6">
				<div className="flex">
					<LogoIcon />
					<div className="hidden sm:flex ml-12">
						<NavMenu />
					</div>
				</div>
				<div className="flex">
					{/* github icon */}
					<div className="hidden sm:flex">
						<GithubIcon />
					</div>
					<div className="flex items-center gap-4">
						{/* sun & moon icons */}
						<DarkModeIcon />
						<EntryIcon />
						{/* mobile navigation menu*/}
						<div
							onClick={handleNav}
							className="sm:hidden cursor-pointer"
						>
							<AiOutlineMenu size={25} />
						</div>
					</div>
					{/* mobile navigation */}
					<div
						className={
							open
								? 'fixed left-0 top-0 w-[65%] md:hidden h-screen p-10 duration-500'
								: 'fixed left-[-100%] top-0 p-10 ease-in duration-500'
						}
					>
						<div
							onClick={handleNav}
							className="cursor-pointer"
						>
							<AiOutlineClose size={25} />
						</div>
						<div className="px-8">
							<div className="flex flex-col gap-8 font-bold tracking-wider mt-10">
								{/* <NavSideMenu /> */}
							</div>
						</div>
					</div>
				</div>
			</div>
		</nav>
	);
};

export default Navbar;
