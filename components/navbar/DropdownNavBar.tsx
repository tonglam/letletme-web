'use client'

import { NavLinks } from '@/components/navbar/NavLinks'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import fplstatistics from '@/public/images/externalSites/fplstatistics.ico'
import hub from '@/public/images/externalSites/hub.ico'
import liveFPL from '@/public/images/externalSites/liveFPL.ico'
import { GitHubLogoIcon as Github } from '@radix-ui/react-icons'
import { LogOut } from 'lucide-react'
import Image, { StaticImageData } from 'next/image'
import Link from 'next/link'
import React from 'react'
import { AiOutlineMenu } from 'react-icons/ai'
import {
	HiMiniPresentationChartLine,
	HiNewspaper,
	HiRocketLaunch,
	HiUserCircle
} from 'react-icons/hi2'
import { IoStatsChart } from 'react-icons/io5'

const iconDefalutStyle = 'mr-2 h-10 w-6'
const subMenuDefalutStyle =
	'flex mr-2 h-10 w-30 space-x-2 text-sm items-center justify-start'

function DropdownNavBar() {
	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
					>
						<AiOutlineMenu className="w-1/2 h-3/4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent className="w-52 h-screen">
					<CustomerDropDownItemContent
						title="My Account"
						href="/user"
					>
						<HiUserCircle className={iconDefalutStyle} />
					</CustomerDropDownItemContent>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuSub>
							<CustomerDropDownSubTrigger title="Live">
								<HiMiniPresentationChartLine className={iconDefalutStyle} />
							</CustomerDropDownSubTrigger>
							<DropdownMenuPortal>
								<DropdownMenuSubContent>
									{NavLinks.liveLinks.map(link => (
										<CustomerDropDownItemContent
											key={link.id}
											title={link.title}
											href={link.href}
										></CustomerDropDownItemContent>
									))}
								</DropdownMenuSubContent>
							</DropdownMenuPortal>
						</DropdownMenuSub>
						<DropdownMenuSub>
							<CustomerDropDownSubTrigger title="Summary">
								<HiNewspaper className={iconDefalutStyle} />
							</CustomerDropDownSubTrigger>
							<DropdownMenuPortal>
								<DropdownMenuSubContent>
									{NavLinks.summaryLinks.map(link => (
										<CustomerDropDownItemContent
											key={link.id}
											title={link.title}
											href={link.href}
										/>
									))}
								</DropdownMenuSubContent>
							</DropdownMenuPortal>
						</DropdownMenuSub>
						<DropdownMenuSub>
							<CustomerDropDownSubTrigger title="Stat">
								<IoStatsChart className={iconDefalutStyle} />
							</CustomerDropDownSubTrigger>
							<DropdownMenuPortal>
								<DropdownMenuSubContent>
									{NavLinks.statLinks.map(link => (
										<CustomerDropDownItemContent
											key={link.id}
											title={link.title}
											href={link.href}
										/>
									))}
								</DropdownMenuSubContent>
							</DropdownMenuPortal>
						</DropdownMenuSub>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuSub>
						<CustomerDropDownSubTrigger title="Price Predictor">
							<HiRocketLaunch className={iconDefalutStyle} />
						</CustomerDropDownSubTrigger>
						<DropdownMenuPortal>
							<DropdownMenuSubContent>
								<CustomerSubDropdownMenuItem
									url="https://www.fplstatistics.co.uk/"
									picture={fplstatistics}
									title="Statistics"
								/>
								<DropdownMenuSeparator />
								<CustomerSubDropdownMenuItem
									url="https://www.livefpl.net/prices"
									picture={liveFPL}
									title="Live FPL"
								/>
								<DropdownMenuSeparator />
								<CustomerSubDropdownMenuItem
									url="https://www.fantasyfootballhub.co.uk/fantasy-premier-league-price-rises"
									picture={hub}
									title="Hub"
								/>
							</DropdownMenuSubContent>
						</DropdownMenuPortal>
					</DropdownMenuSub>
					<CustomerDropDownItemContent
						title="GitHub"
						href="https://github.com/tonglam/letletme-web"
					>
						<Github className={iconDefalutStyle} />
					</CustomerDropDownItemContent>
					<DropdownMenuSeparator />
					<CustomerDropDownItemContent title="Log out">
						<LogOut className={iconDefalutStyle} />
					</CustomerDropDownItemContent>
					<DropdownMenuSeparator />
				</DropdownMenuContent>
			</DropdownMenu>
		</>
	)
}

function CustomerDropDownItemContent({
	children,
	title,
	href
}: {
	children?: React.ReactNode
	title: string
	href?: string
	icon?: string
}) {
	return (
		<DropdownMenuItem>
			<div className={iconDefalutStyle}>{children}</div>
			{href && (
				<Link
					className={children ? '' : subMenuDefalutStyle + 'pr-8'}
					href={href}
					target="_blank"
				/>
			)}
			{title}
		</DropdownMenuItem>
	)
}

function CustomerDropDownSubTrigger({
	children,
	title
}: {
	children: React.ReactNode
	title: string
}) {
	return (
		<DropdownMenuSubTrigger>
			{children}
			<span>{title}</span>
		</DropdownMenuSubTrigger>
	)
}

function CustomerSubDropdownMenuItem({
	url,
	picture,
	title
}: {
	url: string
	picture: StaticImageData
	title: string
}) {
	return (
		<DropdownMenuItem>
			<Link
				className={subMenuDefalutStyle}
				href={url}
				target="_blank"
			>
				<Image
					className="size-4"
					src={picture}
					alt={picture.toString()}
				/>
				{title}
			</Link>
		</DropdownMenuItem>
	)
}

export { DropdownNavBar }
