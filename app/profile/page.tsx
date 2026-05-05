import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { getAuth } from '@/lib/auth'
import { db, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { Trophy, Users } from 'lucide-react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AvatarUpload } from './AvatarUpload'
import RebindEntryForm from './RebindEntryForm'
import SignOutButton from './SignOutButton'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
	const session = await getAuth().api.getSession({ headers: await headers() })

	if (!session) {
		redirect('/auth/login?next=/profile')
	}

	const { user } = session

	const [dbUser] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.id, user.id))
		.limit(1)

	const profile = dbUser ?? user

	return (
		<div className="container max-w-4xl mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold mb-6">My Profile</h1>

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
								<Trophy className="h-4 w-4 text-primary" />
								<span>Member since {new Date(profile.createdAt).getFullYear()}</span>
							</div>
						</div>

						<Separator className="my-6" />

						<SignOutButton />
					</div>
				</Card>

				<Card className="md:col-span-2 p-6">
					<h2 className="text-xl font-bold mb-4 flex items-center gap-2">
						<Trophy className="h-5 w-5 text-primary" />
						Account
					</h2>

					<div className="space-y-4">
						<div className="bg-accent/30 p-4 rounded-lg">
							<h3 className="font-medium mb-2">Email</h3>
							<div className="flex justify-between items-center">
								<p className="text-sm">{profile.email}</p>
								{profile.emailVerified ? (
									<Badge className="bg-green-50 text-green-700 border-green-200">
										Verified
									</Badge>
								) : (
									<Badge variant="outline" className="text-muted-foreground">
										Unverified
									</Badge>
								)}
							</div>
						</div>

						<div className="bg-accent/30 p-4 rounded-lg">
							<h3 className="font-medium mb-3">FPL Team</h3>
							<RebindEntryForm currentEntryId={profile.fplEntryId} fplInfo={null} />
						</div>

						<div className="bg-accent/30 p-4 rounded-lg">
							<h3 className="font-medium mb-3 flex items-center gap-2">
								<Users className="h-4 w-4" />
								Security
							</h3>
							<div className="space-y-2 text-sm">
								<div className="flex items-center justify-between">
									<span>Password</span>
									<Link
										href="/auth/forgot-password"
										className="text-primary hover:underline text-xs"
									>
										Change
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
