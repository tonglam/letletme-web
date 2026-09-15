import type { NavigationUser } from '@/components/profile/HeaderProfileCard'
import { ReportProblemEntry } from '@/components/feedback/ReportProblemEntry'
import { localizePathname, type AppLocale } from '@/i18n/routing'
import { ChevronDown, Settings, Shirt } from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'
import { NavigationMenuLink } from './NavigationMenuLink'
import { SignOutForm } from './SignOutForm'

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
			<ReportProblemEntry
				triggerLabel={t('reportProblem')}
				showReportIcon
				triggerClassName="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			/>
			<SignOutForm
				label={t('signOut')}
				pendingLabel={t('signingOut')}
				errorLabel={t('signOutFailed')}
				redirectHref={homeHref}
			/>
		</div>
	)
}

export async function NavigationActions({ user, mobile = false }: { user: NavigationUser; mobile?: boolean }) {
	const locale = await getLocale()
	const homeHref = localizePathname('/', locale as AppLocale)
	if (mobile) return (
		<div className="mt-3 border-t pt-3" data-navigation-account="mobile">
			<AccountPanel user={user} homeHref={homeHref} />
		</div>
	)
	return (
		<details name="primary-navigation" data-navigation-disclosure className="group relative w-full">
			<summary className="flex min-h-9 cursor-pointer list-none items-center justify-end gap-1 rounded-md px-2 text-fascia-foreground/85 hover:bg-fascia-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric [&::-webkit-details-marker]:hidden">
				<AccountSummary user={user} />
				<ChevronDown aria-hidden="true" className="size-4 shrink-0 opacity-60 transition-transform group-open:rotate-180" />
			</summary>
			<div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
				<AccountPanel user={user} homeHref={homeHref} />
			</div>
		</details>
	)
}
