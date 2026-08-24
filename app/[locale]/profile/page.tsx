import { ReportProblemButton } from '@/components/feedback/ReportProblemButton'
import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Link } from '@/i18n/navigation'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { localizeHref } from '@/i18n/routing'
import { getAuthorizationSession } from '@/lib/auth'
import { db, schema } from '@/lib/db'
import { getVerifiedFplEntryId } from '@/lib/fpl-binding-core'
import { refreshFplIdentitySnapshot } from '@/lib/fpl-entry-binding'
import { and, desc, eq } from 'drizzle-orm'
import { MonitorSmartphone, Trophy, Users } from 'lucide-react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AvatarUpload } from '@/app/profile/AvatarUpload'
import { ProfileIdentitySync } from '@/app/profile/ProfileIdentitySync'
import RebindEntryForm from '@/app/profile/RebindEntryForm'
import SignOutButton from '@/app/profile/SignOutButton'
import { getTranslations } from 'next-intl/server'
import { RouteLoaderTiming } from '@/lib/route-loader-timing'

export const dynamic = 'force-dynamic'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/profile',
		titleKey: 'profileTitle',
		descriptionKey: 'profileDescription',
		noIndex: true
	})
}

export default async function ProfilePage({ params }: PageProps) {
	const timing = new RouteLoaderTiming('/profile')
	const [pageLocale, t, tReport, session] = await Promise.all([
		getPageLocale(params),
		getTranslations('Profile'),
		getTranslations('ReportProblem'),
		timing.measure('session', async () =>
			getAuthorizationSession(await headers())
		)
	])
	const { locale } = pageLocale

	if (!session) {
		timing.finish('redirect-login')
		redirect(localizeHref('/auth/login?next=/profile', locale))
	}

	const { user } = session

	const [dbUser] = await timing.measure('profile', () =>
		db.select().from(schema.user).where(eq(schema.user.id, user.id)).limit(1)
	)

	let profile = dbUser ?? user
	const verifiedEntryId = getVerifiedFplEntryId(profile)

	// The profile page is an explicit identity view. Refresh the display-only
	// FPL name snapshot before rendering so a recent rename is visible now,
	// rather than only after the background 24-hour refresh window.
	if (verifiedEntryId !== null) {
		try {
			await timing.measure('profile-fpl-sync', () =>
				refreshFplIdentitySnapshot(user.id, verifiedEntryId)
			)
			const [syncedUser] = await timing.measure('profile-refresh', () =>
				db
					.select()
					.from(schema.user)
					.where(eq(schema.user.id, user.id))
					.limit(1)
			)
			if (syncedUser) profile = syncedUser
		} catch (error) {
			console.warn('[profile] FPL identity sync failed', {
				error: error instanceof Error ? error.name : 'UnknownError'
			})
		}
	}

	const previousTeamNames =
		verifiedEntryId === null
			? []
			: await timing.measure('profile-name-history', async () => {
					try {
						const rows = await db
							.select({
								teamName: schema.fplEntryNameHistory.teamName,
								lastSeenAt: schema.fplEntryNameHistory.lastSeenAt
							})
							.from(schema.fplEntryNameHistory)
							.where(
								and(
									eq(schema.fplEntryNameHistory.userId, user.id),
									eq(schema.fplEntryNameHistory.entryId, verifiedEntryId)
								)
							)
							.orderBy(desc(schema.fplEntryNameHistory.lastSeenAt))
						return rows
							.filter(
								row =>
									row.teamName.trim().toLocaleLowerCase('en-GB') !==
									(profile.fplTeamName ?? '').trim().toLocaleLowerCase('en-GB')
							)
							.map(row => row.teamName.trim())
					} catch (error) {
						console.warn('[profile] FPL name history unavailable', {
							error: error instanceof Error ? error.name : 'UnknownError'
						})
						return []
					}
				})
	timing.finish('ready')

	return (
		<PageShell>
			<ProfileIdentitySync enabled={verifiedEntryId !== null} />
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<StatsPageHeader title={t('title')} />

				<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
					<Card className="border-border/80 p-6 shadow-sm md:col-span-1">
						<div className="flex flex-col items-center text-center">
							<div className="mb-4">
								<AvatarUpload
									name={profile.name}
									email={profile.email}
									image={profile.image}
								/>
							</div>

							<h2 className="mb-1 font-display text-xl font-bold tracking-tight">
								{profile.name}
							</h2>
							<p className="mb-4 text-muted-foreground">{profile.email}</p>

							<div className="flex w-full flex-col gap-3">
								<div className="flex items-center gap-2 text-sm">
									<Trophy
										className="size-4 text-primary-ink"
										aria-hidden="true"
									/>
									<span>
										{t('memberSince', {
											year: new Date(profile.createdAt).getFullYear()
										})}
									</span>
								</div>
							</div>

							<Separator className="my-6" />

							<SignOutButton />
						</div>
					</Card>

					<Card className="border-border/80 p-6 shadow-sm md:col-span-2">
						<div className="space-y-4">
							<div className="surface-inset rounded-lg border p-4">
								<h3 className="mb-2 font-medium">{t('email')}</h3>
								<div className="flex justify-between items-center">
									<p className="text-sm">{profile.email}</p>
									{profile.emailVerified ? (
										<Badge
											variant="outline"
											className="border-success/30 bg-success/10 text-success"
										>
											{t('verified')}
										</Badge>
									) : (
										<Badge
											variant="outline"
											className="text-muted-foreground"
										>
											{t('unverified')}
										</Badge>
									)}
								</div>
							</div>

							<div className="surface-inset rounded-lg border p-4">
								<h3 className="mb-3 font-medium">{t('fplTeam')}</h3>
								<RebindEntryForm
									currentEntryId={verifiedEntryId}
									verified={verifiedEntryId !== null}
									fplInfo={
										verifiedEntryId !== null && profile.fplTeamName
											? {
													teamName: profile.fplTeamName,
													managerName: profile.fplManagerName ?? '—'
												}
											: null
									}
								/>
								<div className="mt-4 border-t border-border/60 pt-3">
									<p className="text-xs leading-5 text-muted-foreground">
										{t('teamNameSyncHint')}
									</p>
									<p className="mt-3 text-sm font-medium">
										{t('previousTeamNames')}
									</p>
									{previousTeamNames.length > 0 ? (
										<ul className="mt-1 space-y-1 text-sm text-muted-foreground">
											{previousTeamNames.map(name => (
												<li key={name}>· {name}</li>
											))}
										</ul>
									) : (
										<p className="mt-1 text-sm text-muted-foreground">
											{t('noPreviousTeamNames')}
										</p>
									)}
								</div>
							</div>

							<div className="surface-inset rounded-lg border p-4">
								<h3 className="mb-3 flex items-center gap-2 font-medium">
									<Users
										className="size-4"
										aria-hidden="true"
									/>
									{t('security')}
								</h3>
								<div className="space-y-2 text-sm">
									<div className="flex items-center justify-between">
										<span>{t('password')}</span>
										<Link
											href="/auth/forgot-password"
											className="text-xs text-primary-ink underline underline-offset-4 hover:no-underline"
										>
											{t('change')}
										</Link>
									</div>
									<div className="flex items-center justify-between gap-4">
										<span className="flex items-center gap-2">
											<MonitorSmartphone
												className="size-4"
												aria-hidden="true"
											/>
											{t('activeSessions')}
										</span>
										<Button
											asChild
											variant="outline"
											size="sm"
										>
											<Link href="/profile/sessions">{t('manage')}</Link>
										</Button>
									</div>
								</div>
							</div>

							<div className="surface-inset rounded-lg border p-4">
								<h3 className="mb-3 font-medium">{tReport('title')}</h3>
								<p className="mb-3 text-sm text-muted-foreground">
									{tReport('description')}
								</p>
								<ReportProblemButton
									label={tReport('entry')}
									variant="outline"
									className="w-full"
								/>
							</div>
						</div>
					</Card>
				</div>
			</div>
		</PageShell>
	)
}
