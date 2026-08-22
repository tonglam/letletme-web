import TrendsClient from '@/app/data/selections/TrendsClient'
import {
	isTrendCohortReady,
	mergeVisibleTrendCohorts
} from '@/app/data/selections/_lib/trend-cohorts'
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
	if (
		/^(?:competition|custom):[1-9][0-9]*$|^rank-sample:[a-z0-9][a-z0-9._-]{0,63}$/i.test(
			raw
		)
	)
		return raw
	return /^[1-9][0-9]*$/.test(raw) ? `competition:${raw}` : null
}

function findCohort(cohorts: TrendCohort[], id: string | null) {
	return id ? (cohorts.find(cohort => cohort.id === id) ?? null) : null
}

export default async function SelectionsPage({
	params,
	searchParams
}: PageProps) {
	await getPageLocale(params)
	const query = await searchParams
	const eventsPromise = getCurrentAndNextEvents()
	const publicCatalogPromise = loadTrendCohorts('PUBLIC')
		.then(catalog => ({ catalog, loadFailed: false }))
		.catch(error => {
			console.error('[trends] public catalog failed:', error)
			return {
				catalog: {
					season: '',
					revision: '',
					cohorts: [] as TrendCohort[]
				},
				loadFailed: true
			}
		})
	const sessionContext = await getVerifiedEntryContext()
	const myCohortsPromise =
		sessionContext.session && sessionContext.entryId
			? loadTrendCohorts('MINE', sessionContext.session)
					.then(catalog => ({ cohorts: catalog.cohorts, loadFailed: false }))
					.catch(error => {
						console.error('[trends] private catalog failed:', error)
						return { cohorts: [] as TrendCohort[], loadFailed: true }
					})
			: Promise.resolve({ cohorts: [] as TrendCohort[], loadFailed: false })
	const [events, publicCatalogResult, myCohortsResult] = await Promise.all([
		eventsPromise,
		publicCatalogPromise,
		myCohortsPromise
	])
	const publicCatalog = publicCatalogResult.catalog
	const myCohorts = myCohortsResult.cohorts

	const review = resolveReviewGameweekAnchor(events)
	const defaultGameweek = review.anchorGw ?? 1
	const requested = requestedCohort(query)
	const visibleCohorts = mergeVisibleTrendCohorts(
		myCohorts,
		publicCatalog.cohorts
	)
	const requestedSelection = findCohort(visibleCohorts, requested)
	const selected =
		requestedSelection && isTrendCohortReady(requestedSelection)
			? requestedSelection
			: (visibleCohorts.find(isTrendCohortReady) ?? null)
	const initialAccess: TrendAccess = selected?.access ?? 'PUBLIC'
	const initialEventId =
		Number(query.gw) >= 1 && Number(query.gw) <= 38
			? Number(query.gw)
			: (selected?.latestEventId ?? defaultGameweek)
	let initialDesk = null
	let initialDeskError = false
	if (selected) {
		try {
			initialDesk = await loadTrendDesk(
				selected.id,
				initialEventId,
				selected.access,
				sessionContext.session
			)
		} catch (error) {
			console.error('[trends] initial desk failed:', error)
			initialDeskError = true
		}
	}

	return (
		<TrendsClient
			publicCohorts={publicCatalog.cohorts}
			myCohorts={myCohorts}
			canLoadMine={Boolean(sessionContext.session && sessionContext.entryId)}
			myCohortsLoadFailed={myCohortsResult.loadFailed}
			publicCohortsLoadFailed={publicCatalogResult.loadFailed}
			initialDesk={initialDesk}
			initialAccess={initialAccess}
			initialCohortId={selected?.id ?? null}
			initialEventId={initialEventId}
			initialDeskError={initialDeskError}
		/>
	)
}
