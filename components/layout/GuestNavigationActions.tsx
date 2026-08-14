import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { ChevronDown, Menu, UserCircle } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { LanguageSwitcher } from './LanguageSwitcher'
import { NavigationMenuLink } from './NavigationMenuLink'
import { menuItems } from './config'

/**
 * Public navigation is rendered on the server and has no Better Auth client.
 * Native details elements provide keyboard-operable menus without hydration.
 */
export async function GuestNavigationActions() {
	const t = await getTranslations('Navigation')

	return (
		<>
			<div className="ml-6 hidden items-center gap-0.5 md:flex">
				{menuItems.map(item => (
					<details
						key={item.id}
						data-navigation-group={item.id}
						className="group relative"
					>
						<summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 rounded-md px-3 font-display text-xs font-semibold uppercase tracking-caps text-fascia-foreground/70 hover:bg-fascia-foreground/5 hover:text-fascia-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric [&::-webkit-details-marker]:hidden">
							{t(item.labelKey)}
							<ChevronDown
								aria-hidden="true"
								className="size-4 opacity-60 transition-transform group-open:rotate-180"
							/>
						</summary>
						<div className="absolute right-0 top-full z-50 mt-2 min-w-52 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
							{item.items.map(subItem => (
								<Link
									key={subItem.labelKey}
									href={subItem.href}
									prefetch={false}
									className="block rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent focus-visible:bg-accent"
								>
									{t(subItem.labelKey)}
								</Link>
							))}
						</div>
					</details>
				))}
				<Button
					size="sm"
					className="ml-2 font-display text-xs font-semibold uppercase tracking-caps shadow-sticker-sm transition-transform hover:-translate-y-px"
					asChild
				>
					<Link href="/auth/login" prefetch={false}>
						{t('login')}
					</Link>
				</Button>
			</div>

			<LanguageSwitcher />
			<ThemeToggle />

			<details data-navigation-mobile className="group relative md:hidden">
				<summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md text-fascia-foreground hover:bg-fascia-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric [&::-webkit-details-marker]:hidden">
					<Menu aria-hidden="true" className="size-5" />
					<span className="sr-only">{t('openMenu')}</span>
				</summary>
				<div className="absolute right-0 top-full z-50 mt-2 max-h-[calc(100svh-5rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
					{menuItems.map(item => (
						<section key={item.id} className="border-b py-2 last:border-0">
							<p className="px-2 py-1 font-display text-xs font-bold uppercase tracking-caps text-muted-foreground">
								{t(item.labelKey)}
							</p>
							{item.items.map(subItem => (
								<NavigationMenuLink
									key={subItem.labelKey}
									href={subItem.href}
									prefetch={false}
									className="block rounded-md px-2 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								>
									{t(subItem.labelKey)}
								</NavigationMenuLink>
							))}
						</section>
					))}
					<Link
						href="/auth/login"
						prefetch={false}
						className="mt-2 flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<UserCircle aria-hidden="true" className="size-4" />
						{t('login')}
					</Link>
				</div>
			</details>
		</>
	)
}
