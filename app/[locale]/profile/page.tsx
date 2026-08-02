import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Link } from '@/i18n/navigation'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { localizeHref } from '@/i18n/routing'
import { getAuth } from '@/lib/auth'
import { db, schema } from '@/lib/db'
import { getVerifiedFplEntryId, isFplIdentitySnapshotStale } from '@/lib/fpl-binding-core'
import { refreshFplIdentitySnapshot } from '@/lib/fpl-entry-binding'
import { eq } from 'drizzle-orm'
import { Trophy, Users } from 'lucide-react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { AvatarUpload } from '@/app/profile/AvatarUpload'
import RebindEntryForm from '@/app/profile/RebindEntryForm'
import SignOutButton from '@/app/profile/SignOutButton'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/profile',
		titleKey: 'profileTitle',
		descriptionKey: 'profileDescription',
		noIndex: true,
	})
}

export default async function ProfilePage({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	const t = await getTranslations('Profile')
	const session = await getAuth().api.getSession({ headers: await headers() })

	if (!session) {
		redirect(localizeHref('/auth/login?next=/profile', locale))
	}

	const { user } = session

	const [dbUser] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.id, user.id))
		.limit(1)

	const profile = dbUser ?? user
	const verifiedEntryId = getVerifiedFplEntryId(profile)

	// Post-response: re-sync the name snapshot when the persisted snapshot is
	// stale (older than 24h or never refreshed). The throttle marker lives on
	// the user row, so it holds across serverless instances and cold starts.
	if (
		verifiedEntryId !== null &&
		isFplIdentitySnapshotStale(dbUser?.fplIdentityRefreshedAt)
	) {
		after(async () => {
			await refreshFplIdentitySnapshot(user.id, verifiedEntryId)
		})
	}

	return (
		<div className="container max-w-4xl mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold mb-6">{t('title')}</h1>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<Card className="md:col-span-1 p-6">
					<div className="flex flex-col items-center text-center">
						<div className="mb-4">
							<AvatarUpload
								name={profile.name}
								email={profile.email}
								image={profile.image}
							/>
						</div>

						<h2 className="text-xl font-bold mb-1">{profile.name}</h2>
						<p className="text-muted-foreground mb-4">{profile.email}</p>

						<div className="w-full flex flex-col gap-3">
							<div className="flex items-center gap-2 text-sm">
								<Trophy className="h-4 w-4 text-primary-ink" />
								<span>{t('memberSince', { year: new Date(profile.createdAt).getFullYear() })}</span>
							</div>
						</div>

						<Separator className="my-6" />

						<SignOutButton />
					</div>
				</Card>

				<Card className="md:col-span-2 p-6">
					<h2 className="text-xl font-bold mb-4 flex items-center gap-2">
						<Trophy className="h-5 w-5 text-primary-ink" />
						{t('account')}
					</h2>

					<div className="space-y-4">
						<div className="bg-accent/30 p-4 rounded-lg">
							<h3 className="font-medium mb-2">{t('email')}</h3>
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
									<Badge variant="outline" className="text-muted-foreground">
										{t('unverified')}
									</Badge>
								)}
							</div>
						</div>

						<div className="bg-accent/30 p-4 rounded-lg">
							<h3 className="font-medium mb-3">{t('fplTeam')}</h3>
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

						<div className="bg-accent/30 p-4 rounded-lg">
							<h3 className="font-medium mb-3 flex items-center gap-2">
								<Users className="h-4 w-4" />
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
							</div>
						</div>
					</div>
				</Card>
			</div>
		</div>
	)
}
