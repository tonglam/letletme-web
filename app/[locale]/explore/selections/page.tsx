import TrendsClient from '@/app/data/selections/TrendsClient'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { getCurrentAndNextEvents } from '@/lib/events'
import { getVerifiedEntryContext } from '@/lib/session'
import { loadTrendCohorts, loadTrendDesk } from '@/lib/trends-server'
import type { TrendAccess, TrendCohort } from '@/lib/graphql/operations/trends'
import { resolveReviewGameweekAnchor } from '@/lib/review-gameweek'

export const dynamic = 'force-dynamic'

type PageProps = {
	params: LocaleParams
	searchParams: Promise<{
		scope?: string
		cohort?: string
		tournament?: string
		gw?: string
	}>
}

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/explore/selections',
		titleKey: 'selectionsTitle',
		descriptionKey: 'selectionsDescription'
	})
}

function requestedCohort(query: Awaited<PageProps['searchParams']>) {
	const raw = query.cohort ?? query.tournament
	if (!raw) return null
	return raw.startsWith('competition:') ? raw : /^\d+$/.test(raw) ? `competition:${raw}` : null
}

function findCohort(cohorts: TrendCohort[], id: string | null) {
	return id ? cohorts.find(cohort => cohort.id === id) ?? null : null
}

export default async function SelectionsPage({ params, searchParams }: PageProps) {
	await getPageLocale(params)
	const query = await searchParams
	const [events, sessionContext, publicCatalog] = await Promise.all([
		getCurrentAndNextEvents(),
		getVerifiedEntryContext(),
		loadTrendCohorts('PUBLIC').catch(error => {
			console.error('[trends] public catalog failed:', error)
			return { season: '', revision: '', cohorts: [] as TrendCohort[] }
		})
	])

	const review = resolveReviewGameweekAnchor(events)
	const defaultGameweek = review.anchorGw ?? 1
	const requested = requestedCohort(query)
	const requestedAccess: TrendAccess | null = query.scope === 'mine' ? 'MINE' : query.scope === 'public' ? 'PUBLIC' : null
	let myCohorts: TrendCohort[] = []
	const shouldLoadMine = requestedAccess === 'MINE' || (!requestedAccess && !findCohort(publicCatalog.cohorts, requested))
	if (shouldLoadMine && sessionContext.session && sessionContext.entryId) {
		try {
			myCohorts = (await loadTrendCohorts('MINE', sessionContext.session)).cohorts
		} catch (error) {
			console.error('[trends] private catalog failed:', error)
		}
	}

	const selectedMine = findCohort(myCohorts, requested)
	const selectedPublic = findCohort(publicCatalog.cohorts, requested)
	const initialAccess: TrendAccess = requestedAccess === 'MINE' || (!requestedAccess && Boolean(selectedMine)) ? 'MINE' : 'PUBLIC'
	const activeCohorts = initialAccess === 'MINE' ? myCohorts : publicCatalog.cohorts
	const selected = initialAccess === 'MINE'
		? selectedMine ?? activeCohorts[0] ?? null
		: selectedPublic ?? activeCohorts[0] ?? null
	const initialEventId = Number(query.gw) >= 1 && Number(query.gw) <= 38
		? Number(query.gw)
		: selected?.latestEventId ?? defaultGameweek
	let initialDesk = null
	if (selected) {
		try {
			initialDesk = await loadTrendDesk(selected.id, initialEventId, initialAccess, sessionContext.session)
		} catch (error) {
			console.error('[trends] initial desk failed:', error)
		}
	}

	return <TrendsClient
		publicCohorts={publicCatalog.cohorts}
		myCohorts={myCohorts}
		canLoadMine={Boolean(sessionContext.session && sessionContext.entryId)}
		initialDesk={initialDesk}
		initialAccess={initialAccess}
		initialCohortId={selected?.id ?? null}
		initialEventId={initialEventId}
	/>
}
