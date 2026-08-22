import type { NavigationUser } from '@/components/profile/HeaderProfileCard'
import { ReportProblemEntry } from '@/components/feedback/ReportProblemEntry'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { localizePathname, type AppLocale } from '@/i18n/routing'
import { ChevronDown, Menu, MessageCircleWarning, Settings, Shirt } from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'
import { LanguageSwitcher } from './LanguageSwitcher'
import { NavigationDisclosureController } from './NavigationDisclosureController'
import { NavigationMenuLink } from './NavigationMenuLink'
import { SignOutForm } from './SignOutForm'
import { menuItems } from './config'

function AccountSummary({
	user,
	compact = false
}: {
	user: NavigationUser
	compact?: boolean
}) {
	const name = user.name?.trim() || user.email
	const initial = name.charAt(0).toUpperCase()
	return (
		<span className="flex min-w-0 items-center gap-2">
			<span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 font-display text-xs font-bold text-electric">
				{initial}
			</span>
			{compact ? null : (
				<span className="max-w-28 truncate text-sm font-medium">{name}</span>
			)}
		</span>
	)
}

async function AccountPanel({
	user,
	homeHref
}: {
	user: NavigationUser
	homeHref: string
}) {
	const t = await getTranslations('Navigation')
	const verifiedEntryId =
		typeof user.fplEntryId === 'number' &&
		user.fplEntryId > 0 &&
		Boolean(user.fplEntryVerifiedAt)
			? user.fplEntryId
			: null
	const accountName = user.name?.trim() || user.email
	const teamName = user.fplTeamName?.trim() || t('fplTeamUntitled')

	return (
		<div className="space-y-3">
			<div>
				<p className="truncate text-sm font-semibold">{accountName}</p>
				{accountName !== user.email ? (
					<p className="truncate text-xs text-muted-foreground">{user.email}</p>
				) : null}
			</div>
			<div className="rounded-md border bg-muted/35 px-3 py-2">
				<p className="flex items-center gap-1.5 eyebrow">
					<Shirt aria-hidden="true" className="size-3" />
					{t('fplTeamLabel')}
				</p>
				{verifiedEntryId === null ? (
					<NavigationMenuLink
						href="/onboarding/bind-entry"
						prefetch={false}
						className="mt-2 block text-xs font-semibold text-primary-ink underline-offset-4 hover:underline"
					>
						{t('linkFplTeam')}
					</NavigationMenuLink>
				) : (
					<>
						<p className="mt-2 truncate font-display text-sm font-bold uppercase tracking-wide">
							{teamName}
						</p>
						<p className="mt-1 font-mono text-xs text-muted-foreground">
							#{verifiedEntryId}
						</p>
					</>
				)}
			</div>
			<NavigationMenuLink
				href="/profile"
				prefetch={false}
				className="flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<Settings aria-hidden="true" className="size-4" />
				{t('profileSettings')}
			</NavigationMenuLink>
			<ReportProblemEntry>
				<button
					type="button"
					className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<MessageCircleWarning aria-hidden="true" className="size-4" />
					{t('reportProblem')}
				</button>
			</ReportProblemEntry>
			<SignOutForm
				label={t('signOut')}
				pendingLabel={t('signingOut')}
				errorLabel={t('signOutFailed')}
				redirectHref={homeHref}
			/>
		</div>
	)
}

export async function NavigationActions({ user }: { user: NavigationUser }) {
	const [t, locale] = await Promise.all([
		getTranslations('Navigation'),
		getLocale()
	])
	const homeHref = localizePathname('/', locale as AppLocale)

	return (
		<NavigationDisclosureController>
			<div className="ml-6 hidden items-center gap-0.5 md:flex">
				{menuItems.map(item => (
					item.directHref ? (
						<NavigationMenuLink
							key={item.id}
							href={item.directHref}
							prefetch={false}
							className="block rounded-md px-3 py-2 font-display text-xs font-semibold uppercase tracking-caps text-fascia-foreground/70 hover:bg-fascia-foreground/5 hover:text-fascia-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"
						>
							{t(item.labelKey)}
						</NavigationMenuLink>
					) : (
					<details
						key={item.id}
						name="primary-navigation"
						data-navigation-group={item.id}
						data-navigation-disclosure
						className="group relative"
					>
						<summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 rounded-md px-3 font-display text-xs font-semibold uppercase tracking-caps text-fascia-foreground/70 hover:bg-fascia-foreground/5 hover:text-fascia-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric [&::-webkit-details-marker]:hidden">
							{t(item.labelKey)}
							<ChevronDown aria-hidden="true" className="size-4 opacity-60 transition-transform group-open:rotate-180" />
						</summary>
						<div className="absolute right-0 top-full z-50 mt-2 min-w-52 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
							{item.items.map(subItem => (
								<NavigationMenuLink
									key={subItem.labelKey}
									href={subItem.href}
									prefetch={false}
									className="block rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent focus-visible:bg-accent"
								>
									{t(subItem.labelKey)}
								</NavigationMenuLink>
							))}
						</div>
					</details>
					)
				))}
				<details
					name="primary-navigation"
					data-navigation-disclosure
					className="group relative ml-2"
				>
					<summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 rounded-md px-2 text-fascia-foreground/85 hover:bg-fascia-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric [&::-webkit-details-marker]:hidden">
						<AccountSummary user={user} />
						<ChevronDown aria-hidden="true" className="size-4 opacity-60 transition-transform group-open:rotate-180" />
					</summary>
					<div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
						<AccountPanel user={user} homeHref={homeHref} />
					</div>
				</details>
			</div>

			<LanguageSwitcher />
			<ThemeToggle />

			<details
				name="primary-navigation"
				data-navigation-mobile
				data-navigation-disclosure
				className="group relative md:hidden"
			>
				<summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md text-fascia-foreground hover:bg-fascia-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric [&::-webkit-details-marker]:hidden">
					<Menu aria-hidden="true" className="size-5" />
					<span className="sr-only">{t('openMenu')}</span>
				</summary>
				<div className="absolute right-0 top-full z-50 mt-2 max-h-[calc(100svh-5rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
					<div className="mb-3 flex items-center gap-2 border-b pb-3">
						<AccountSummary user={user} compact />
						<p className="min-w-0 truncate text-sm font-semibold">
							{user.name?.trim() || user.email}
						</p>
					</div>
					{menuItems.map(item => (
						item.directHref ? (
							<NavigationMenuLink
								key={item.id}
								href={item.directHref}
								prefetch={false}
								className="block rounded-md px-2 py-3 text-sm font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								{t(item.labelKey)}
							</NavigationMenuLink>
						) : (
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
						)
					))}
					<div className="mt-3 border-t pt-3">
						<AccountPanel user={user} homeHref={homeHref} />
					</div>
				</div>
			</details>
		</NavigationDisclosureController>
	)
}
