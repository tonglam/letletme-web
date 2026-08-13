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
import { getVerifiedFplEntryId, isFplIdentitySnapshotStale } from '@/lib/fpl-binding-core'
import { claimFplIdentityRefresh, refreshFplIdentitySnapshot } from '@/lib/fpl-entry-binding'
import { eq } from 'drizzle-orm'
import { MonitorSmartphone, Trophy, Users } from 'lucide-react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { AvatarUpload } from '@/app/profile/AvatarUpload'
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
	const [pageLocale, t, session] = await Promise.all([
		getPageLocale(params),
		getTranslations('Profile'),
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
		db
			.select()
			.from(schema.user)
			.where(eq(schema.user.id, user.id))
			.limit(1)
	)

	const profile = dbUser ?? user
	const verifiedEntryId = getVerifiedFplEntryId(profile)

	// Post-response: re-sync the name snapshot when the persisted snapshot is
	// stale (older than 24h or never refreshed). The cheap staleness read comes
	// from the already-loaded row; the claim UPDATE below then atomically
	// picks a single winner across concurrent tabs/instances.
	if (
		verifiedEntryId !== null &&
		isFplIdentitySnapshotStale(dbUser?.fplIdentityRefreshedAt)
	) {
		after(async () => {
			if (await claimFplIdentityRefresh(user.id, verifiedEntryId)) {
				await refreshFplIdentitySnapshot(user.id, verifiedEntryId)
			}
		})
	}
	timing.finish('ready')

	return (
		<PageShell>
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<StatsPageHeader eyebrow={t('account')} title={t('title')} />

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
								<Trophy className="size-4 text-primary-ink" aria-hidden="true" />
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
					<h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold tracking-tight sm:text-xl">
						<Trophy className="size-5 text-primary-ink" aria-hidden="true" />
						{t('account')}
					</h2>

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
									verifiedEntryId !== null && profile.fplTeamName && profile.fplManagerName
										? { teamName: profile.fplTeamName, managerName: profile.fplManagerName }
										: null
								}
							/>
						</div>

						<div className="surface-inset rounded-lg border p-4">
							<h3 className="mb-3 flex items-center gap-2 font-medium">
								<Users className="size-4" aria-hidden="true" />
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
										<MonitorSmartphone className="size-4" aria-hidden="true" />
										{t('activeSessions')}
									</span>
									<Button asChild variant="outline" size="sm">
										<Link href="/profile/sessions">{t('manage')}</Link>
									</Button>
								</div>
							</div>
						</div>
					</div>
				</Card>
			</div>
			</div>
		</PageShell>
	)
}
