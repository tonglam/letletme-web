'use client'

import NavLinks from '@/components/navbar/NavLinks'
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger
} from '@/components/ui/navigation-menu'
import { cn } from '@/lib/utils'
import * as React from 'react'

const NavigationTriggerClass = 'text-lg gap-2'

const NavigationItemClass =
	'grid w-[400px] p-4 md:w-[500px] md:grid-cols-2 md:w-[600px]'

function NavBar() {
	return (
		<section>
			<NavigationMenu>
				<NavigationMenuList>
					<NavigationMenuItem>
						<NavigationMenuTrigger className={NavigationTriggerClass}>
							实时
						</NavigationMenuTrigger>
						<NavigationMenuContent>
							<ul className={NavigationItemClass}>
								{NavLinks.liveLinks.map(component => (
									<ListItem
										key={component.title}
										title={component.title}
										href={component.href}
									>
										{component.description}
									</ListItem>
								))}
							</ul>
						</NavigationMenuContent>
					</NavigationMenuItem>
					<NavigationMenuItem>
						<NavigationMenuTrigger className={NavigationTriggerClass}>
							统计
						</NavigationMenuTrigger>
						<NavigationMenuContent>
							<ul className={NavigationItemClass}>
								{NavLinks.summaryLinks.map(component => (
									<ListItem
										key={component.title}
										title={component.title}
										href={component.href}
									>
										{component.description}
									</ListItem>
								))}
							</ul>
						</NavigationMenuContent>
					</NavigationMenuItem>
					<NavigationMenuItem>
						<NavigationMenuTrigger className={NavigationTriggerClass}>
							数据
						</NavigationMenuTrigger>
						<NavigationMenuContent>
							<ul className={NavigationItemClass}>
								{NavLinks.statLinks.map(component => (
									<ListItem
										key={component.title}
										title={component.title}
										href={component.href}
									>
										{component.description}
									</ListItem>
								))}
							</ul>
						</NavigationMenuContent>
					</NavigationMenuItem>
				</NavigationMenuList>
			</NavigationMenu>
		</section>
	)
}

const ListItem = React.forwardRef<
	React.ElementRef<'a'>,
	React.ComponentPropsWithoutRef<'a'>
>(({ className, title, children, ...props }, ref) => {
	return (
		<li>
			<NavigationMenuLink asChild>
				<a
					ref={ref}
					className={cn(
						'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
						className
					)}
					{...props}
				>
					<div className="text-base font-medium leading-none">{title}</div>
					<p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
						{children}
					</p>
				</a>
			</NavigationMenuLink>
		</li>
	)
})
ListItem.displayName = 'ListItem'

export default NavBar
