import { PriceChangesBoard } from '@/app/data/price-changes/PriceChangesBoard'
import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { Badge } from '@/components/ui/badge'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { withCapacityRunForRequest } from '@/lib/capacity-run'
import { getCurrentAndNextEvents, pickCurrentEventId } from '@/lib/events'
import { EMPTY_PRICE_CHANGE_BOARD } from '@/lib/graphql/operations/price-changes'
import { loadPriceChangeBoard } from '@/lib/price-change-server'
import {
	loadPersonalPriceContext,
} from '@/lib/price-change-personal-server'
import type { PersonalPriceContext } from '@/lib/price-change-personal'
import { loadEntrySquadPicks } from '@/lib/load-entry-squad-picks'
import type {
	EntrySquadPicksResult,
	SquadLoadState,
	SquadPickSeed,
} from '@/lib/squad-picks'
import { getVerifiedEntryContext } from '@/lib/session'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/explore/price-changes',
		titleKey: 'priceChangeBoardTitle',
		descriptionKey: 'priceChangeBoardDescription'
	})
}

function statusBadgeClass(status: string): string {
	if (status === 'READY') return 'border-success/45 bg-success/10 text-success'
	if (status === 'PARTIAL' || status === 'STALE') {
		return 'border-warning/45 bg-warning/10 text-warning'
	}
	if (status === 'UNAVAILABLE')
		return 'border-destructive/45 bg-destructive/10 text-destructive'
	return 'border-border/70 bg-muted/30 text-muted-foreground'
}

async function renderPriceChangesPage({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	const t = await getTranslations('PriceChanges')
	const boardPromise = loadPriceChangeBoard().catch(error => {
		console.error('[price-changes] board seed failed:', error)
		return { priceChangeBoard: EMPTY_PRICE_CHANGE_BOARD }
	})
	const [events, identity] = await Promise.all([
		getCurrentAndNextEvents(),
		getVerifiedEntryContext()
	])

	let mySquadElementIds: number[] = []
	let mySquadPicks: SquadPickSeed[] = []
	let mySquadState: SquadLoadState =
		identity.entryId != null ? 'not-published' : 'unbound'
	let squadPromise: Promise<EntrySquadPicksResult | null> =
		Promise.resolve(null)
	if (identity.session && identity.entryId != null) {
		squadPromise = loadEntrySquadPicks(
			identity.session,
			identity.entryId,
			events
		).catch(error => {
			console.error('[price-changes] squad seed failed:', error)
			return null
		})
	}

	const [boardResponse, squad] = await Promise.all([boardPromise, squadPromise])
	if (squad) {
		mySquadPicks = squad.picks
		mySquadElementIds = squad.picks
			.map(pick => pick.elementId)
			.filter((id): id is number => id != null && id > 0)
		mySquadState = squad.state
	} else if (identity.session && identity.entryId != null) {
		mySquadState = 'unavailable'
	}

	let personalPriceContext: PersonalPriceContext = {
		state: 'UNAVAILABLE',
		purchasePrices: {}
	}
	if (
		identity.session &&
		identity.entryId != null &&
		mySquadPicks.length > 0
	) {
		personalPriceContext = await loadPersonalPriceContext({
			session: identity.session,
			entryId: identity.entryId,
			picks: mySquadPicks,
			eventId: pickCurrentEventId(events) ?? events?.next?.[0]?.id ?? null,
		})
	}

	const board = boardResponse.priceChangeBoard
	const statusLabel =
		board.status === 'READY'
			? t('fresh')
			: board.status === 'PARTIAL'
				? t('partial')
				: board.status === 'STALE'
					? t('stale')
					: t('unavailable')

	return (
		<PageShell>
			<div className="container mx-auto max-w-6xl px-4 py-8">
				<StatsPageHeader
					title={t('title')}
					badge={
						<Badge
							variant="outline"
							className={statusBadgeClass(board.status)}
						>
							{statusLabel}
						</Badge>
					}
				/>
				<p className="-mt-4 mb-6 max-w-3xl text-sm leading-6 text-muted-foreground">
					{t('pageIntro')}
				</p>
				<PriceChangesBoard
					board={board}
					locale={locale}
					mySquadElementIds={mySquadElementIds}
					mySquadState={mySquadState}
					personalPurchasePrices={personalPriceContext.purchasePrices}
					personalPriceState={personalPriceContext.state}
				/>
			</div>
		</PageShell>
	)
}

export default async function PriceChangesPage(props: PageProps) {
	return withCapacityRunForRequest(() => renderPriceChangesPage(props))
}
