import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getAuth } from '@/lib/auth'
import { Gamepad, Hash } from 'lucide-react'

export const dynamic = 'force-dynamic'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { bindFplEntry } from './actions'
import BindEntryForm from './BindEntryForm'

export default async function BindEntryPage() {
	const session = await getAuth().api.getSession({ headers: await headers() })

	if (!session) {
		redirect('/auth/login?next=/onboarding/bind-entry')
	}

	// Already bound — skip onboarding
	if (session.user.fplEntryId) {
		redirect('/')
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
			<div className="mb-6 flex items-center gap-2">
				<Gamepad className="h-8 w-8 text-primary" />
				<h1 className="text-2xl font-bold">LetLetMe</h1>
			</div>

			<Card className="w-full max-w-md p-6">
				<div className="mb-6 text-center">
					<div className="flex justify-center mb-3">
						<Hash className="h-10 w-10 text-primary" />
					</div>
					<h2 className="text-2xl font-bold tracking-tight">
						Link your FPL team
					</h2>
					<p className="text-sm text-muted-foreground mt-1">
						Enter your FPL entry ID so we can track your team stats,
						tournaments, and live points.
					</p>
				</div>

				<div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground mb-6">
					<p className="font-medium mb-1">How to find your entry ID</p>
					<ol className="list-decimal list-inside space-y-1">
						<li>
							Open{' '}
							<span className="font-mono">fantasy.premierleague.com</span> and
							sign in
						</li>
						<li>Go to &quot;Points&quot; or &quot;Pick Team&quot;</li>
						<li>Your entry ID is the number in the URL</li>
						<li>
							e.g.{' '}
							<span className="font-mono">
								…/entry/<strong>123456</strong>/event/…
							</span>
						</li>
					</ol>
				</div>

				<BindEntryForm />
			</Card>
		</div>
	)
}
