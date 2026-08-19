'use client'

import { ReportProblemEntry } from '@/components/feedback/ReportProblemEntry'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Link, useRouter } from '@/i18n/navigation'
import { signOut } from '@/lib/auth-client'
import { getVerifiedFplEntryId } from '@/lib/fpl-binding-core'
import { LogOut, MessageCircleWarning, Settings, Shirt, UserRound } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

export interface NavigationUser {
	name?: string | null
	email: string
	image?: string | null
	fplEntryId?: number | null
	fplEntryVerifiedAt?: Date | string | null
	fplTeamName?: string | null
	fplManagerName?: string | null
}

export function HeaderProfileCard({ user }: { user: NavigationUser }) {
	const router = useRouter()
	const t = useTranslations('Navigation')
	const [signingOut, setSigningOut] = useState(false)
	const [menuOpen, setMenuOpen] = useState(false)
	const [reportOpen, setReportOpen] = useState(false)
	const initials = (user.name ?? user.email).charAt(0).toUpperCase()
	const verifiedEntryId = getVerifiedFplEntryId(user)
	const accountName = user.name?.trim() || ''
	const fplTeamName = user.fplTeamName?.trim() || ''
	const fplManagerName = user.fplManagerName?.trim() || ''

	const handleSignOut = async () => {
		setSigningOut(true)
		try {
			const { error } = await signOut()
			if (error) {
				toast.error(t('signOutFailed'))
				return
			}
			router.push('/')
			router.refresh()
		} catch {
			toast.error(t('signOutFailed'))
		} finally {
			setSigningOut(false)
		}
	}

	return (
		<>
		<DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					className="h-9 gap-2 px-2 text-fascia-foreground/85 hover:bg-fascia-foreground/5 hover:text-fascia-foreground"
					aria-label={t('openAccountMenu', { name: accountName || user.email })}
				>
					<Avatar className="h-6 w-6">
						<AvatarImage
							src={user.image ?? undefined}
							alt={accountName}
						/>
						<AvatarFallback className="bg-primary/10 text-xs text-primary-ink">
							{initials}
						</AvatarFallback>
					</Avatar>
					<span className="hidden max-w-[120px] truncate text-sm lg:inline">
						{accountName || user.email}
					</span>
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent
				align="end"
				className="w-72 p-0"
				sideOffset={8}
			>
				{/* LetLetMe account — platform identity */}
				<section className="border-b border-border/80 p-3">
					<p className="mb-2 flex items-center gap-1.5 eyebrow">
						<UserRound aria-hidden="true" className="size-3" />
						{t('accountLabel')}
					</p>
					<div className="flex items-center gap-3">
						<Avatar className="h-10 w-10 shrink-0">
							<AvatarImage
								src={user.image ?? undefined}
								alt={accountName}
							/>
							<AvatarFallback className="bg-primary/10 text-primary-ink">
								{initials}
							</AvatarFallback>
						</Avatar>
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-semibold leading-tight">
								{accountName || user.email}
							</p>
							{accountName ? (
								<p className="mt-0.5 truncate text-xs text-muted-foreground">
									{user.email}
								</p>
							) : null}
						</div>
					</div>
				</section>

				{/* FPL squad — separate domain from account name */}
				<section className="border-b border-border/80 bg-muted/35 p-3">
					<div className="mb-2 flex items-center justify-between gap-2">
						<p className="flex items-center gap-1.5 eyebrow">
							<Shirt aria-hidden="true" className="size-3" />
							{t('fplTeamLabel')}
						</p>
						{verifiedEntryId !== null ? (
							<span className="rounded-sm bg-success/15 px-1.5 py-0.5 font-mono text-label font-semibold uppercase tracking-wide text-success">
								{t('fplLinked')}
							</span>
						) : (
							<span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-label font-semibold uppercase tracking-wide text-muted-foreground">
								{t('fplNotLinked')}
							</span>
						)}
					</div>

					{verifiedEntryId !== null ? (
						<div className="rounded-lg border border-plum/20 bg-card px-3 py-2.5">
							<p className="truncate font-display text-sm font-bold uppercase tracking-wide">
								{fplTeamName || t('fplTeamUntitled')}
							</p>
							<dl className="mt-2 space-y-1">
								<div className="flex items-baseline justify-between gap-3">
									<dt className="eyebrow shrink-0">
										{t('fplManagerLabel')}
									</dt>
									<dd className="min-w-0 truncate text-right text-xs font-medium">
										{fplManagerName || '—'}
									</dd>
								</div>
								<div className="flex items-baseline justify-between gap-3">
									<dt className="eyebrow shrink-0">
										{t('fplEntryLabel')}
									</dt>
									<dd className="font-mono text-xs tabular-nums text-muted-foreground">
										#{verifiedEntryId}
									</dd>
								</div>
							</dl>
						</div>
					) : (
						<div className="rounded-lg border border-dashed border-border px-3 py-2.5">
							<p className="text-xs leading-5 text-muted-foreground">
								{t('fplLinkHint')}
							</p>
							<Link
								href="/onboarding/bind-entry"
								className="mt-2 inline-flex text-xs font-semibold text-primary-ink underline-offset-4 hover:underline"
							>
								{t('linkFplTeam')}
							</Link>
						</div>
					)}
				</section>

				<div className="p-1">
					<DropdownMenuItem asChild>
						<Link
							href="/profile"
							className="cursor-pointer"
						>
							<Settings className="mr-2 h-4 w-4" />
							{t('profileSettings')}
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem
						className="cursor-pointer"
						onSelect={event => {
							event.preventDefault()
							setMenuOpen(false)
							setReportOpen(true)
						}}
					>
						<MessageCircleWarning className="mr-2 h-4 w-4" />
						{t('reportProblem')}
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onClick={handleSignOut}
						disabled={signingOut}
						className="cursor-pointer text-destructive focus:text-destructive"
					>
						<LogOut className="mr-2 h-4 w-4" />
						{signingOut ? t('signingOut') : t('signOut')}
					</DropdownMenuItem>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
		<ReportProblemEntry open={reportOpen} onOpenChange={setReportOpen} />
		</>
	)
}
