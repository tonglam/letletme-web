import { LiveMatchesClient } from '@/app/live/matches/LiveMatchesClient'
import PageShell from '@/components/layout/PageShell'
import { getCurrentAndNextEvents } from '@/lib/events'
import { getLiveMatchesSnapshot } from '@/lib/live-matches'
import { executePublicServerQuery } from '@/lib/graphql-server'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/live/matches',
		titleKey: 'liveMatchesTitle',
		descriptionKey: 'liveMatchesDescription'
	})
}

function LiveMatchesFallback() {
	const t = useTranslations('LiveMatches')
	return (
		<PageShell>
			<div className="container max-w-4xl mx-auto px-4 py-8">
				<div className="flex items-center justify-between mb-8">
					<h1 className="text-3xl font-bold">{t('title')}</h1>
					<div className="h-9 w-9 rounded-md border bg-muted/40" />
				</div>
				<div className="bg-card rounded-lg p-4 mb-6 shadow-sm">
					<div className="grid grid-cols-4 gap-2 sm:gap-4">
						{[t('liveNow'), t('finished'), t('notStarted'), t('upcoming')].map(
							label => (
								<div
									key={label}
									className="h-9 rounded-md bg-muted/60"
									aria-label={label}
								/>
							)
						)}
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
	const t = await getTranslations('States')
	let matches: Awaited<ReturnType<typeof getLiveMatchesSnapshot>>['matches'] =
		[]
	let snapshot: Awaited<ReturnType<typeof getLiveMatchesSnapshot>>['snapshot'] =
		null
	let initialError: string | null = null
	let currentEventId: number | undefined

	const [liveResult, eventsResult] = await Promise.allSettled([
		getLiveMatchesSnapshot(executePublicServerQuery),
		getCurrentAndNextEvents()
	])
	if (liveResult.status === 'fulfilled') {
		matches = liveResult.value.matches
		snapshot = liveResult.value.snapshot
	} else {
		console.error('Failed to fetch live matches:', liveResult.reason)
		initialError = t('matchesFailed')
	}
	if (eventsResult.status === 'fulfilled') {
		currentEventId = eventsResult.value?.current[0]?.id
	} else {
		console.error('Failed to fetch current live event:', eventsResult.reason)
	}
	currentEventId ??= snapshot?.eventId

	return (
		<LiveMatchesClient
			initialMatches={matches}
			initialError={initialError}
			currentEventId={currentEventId}
			initialSnapshot={snapshot}
		/>
	)
}

export default async function LiveMatchesPage({ params }: PageProps) {
	await getPageLocale(params)
	return (
		<Suspense fallback={<LiveMatchesFallback />}>
			<LiveMatchesContent />
		</Suspense>
	)
}
