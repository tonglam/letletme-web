import { LiveMatchesClient } from '@/app/live/matches/LiveMatchesClient'
import PageShell from '@/components/layout/PageShell'
import { getCurrentAndNextEvents } from '@/lib/events'
import { getLiveMatches } from '@/lib/live-matches'
import { executePublicServerQuery } from '@/lib/graphql-server'
import type { Metadata } from 'next'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
	title: 'Live matches',
	description: 'Follow FPL fixtures, live scores, and player events by match status.',
}

function LiveMatchesFallback() {
	return (
		<PageShell>
			<div className="container max-w-4xl mx-auto px-4 py-8">
				<div className="flex items-center justify-between mb-8">
					<h1 className="text-3xl font-bold">Live Matches</h1>
					<div className="h-9 w-9 rounded-md border bg-muted/40" />
				</div>
				<div className="bg-card rounded-lg p-4 mb-6 shadow-sm">
					<div className="grid grid-cols-4 gap-2 sm:gap-4">
						{['Live Now', 'Finished', 'Not Started', 'Upcoming'].map((label) => (
							<div
								key={label}
								className="h-9 rounded-md bg-muted/60"
								aria-label={label}
							/>
						))}
					</div>
				</div>
				<div className="space-y-4">
					<div className="h-24 rounded-lg bg-muted/50" />
					<div className="h-24 rounded-lg bg-muted/40" />
				</div>
			</div>
		</PageShell>
	)
}

async function LiveMatchesContent() {
	let matches: Awaited<ReturnType<typeof getLiveMatches>> = []
	let initialError: string | null = null
	let currentEventId: number | undefined

	try {
		const [matchesResult, events] = await Promise.all([
			getLiveMatches(executePublicServerQuery),
			getCurrentAndNextEvents(),
		])
		matches = matchesResult
		currentEventId = events?.current[0]?.id
	} catch (err) {
		console.error('Failed to fetch live matches:', err)
		initialError = err instanceof Error ? err.message : 'Failed to load matches'
	}

	return (
		<LiveMatchesClient
			initialMatches={matches}
			initialError={initialError}
			currentEventId={currentEventId}
		/>
	)
}

export default function LiveMatchesPage() {
	return (
		<Suspense fallback={<LiveMatchesFallback />}>
			<LiveMatchesContent />
		</Suspense>
	)
}
