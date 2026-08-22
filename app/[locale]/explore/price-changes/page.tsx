import { PriceChangesBoard } from '@/app/data/price-changes/PriceChangesBoard'
import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { Badge } from '@/components/ui/badge'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { withCapacityRunForRequest } from '@/lib/capacity-run'
import { getCurrentAndNextEvents } from '@/lib/events'
import { EMPTY_PRICE_CHANGE_BOARD } from '@/lib/graphql/operations/price-changes'
import { loadPriceChangeBoard } from '@/lib/price-change-server'
import { loadEntrySquadPicks } from '@/lib/load-entry-squad-picks'
import type { SquadLoadState } from '@/lib/squad-picks'
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
	const [boardResponse, events, identity] = await Promise.all([
		loadPriceChangeBoard().catch(error => {
			console.error('[price-changes] board seed failed:', error)
			return { priceChangeBoard: EMPTY_PRICE_CHANGE_BOARD }
		}),
		getCurrentAndNextEvents(),
		getVerifiedEntryContext()
	])

	let mySquadElementIds: number[] = []
	let mySquadState: SquadLoadState =
		identity.entryId != null ? 'not-published' : 'unbound'
	if (identity.session && identity.entryId != null) {
		try {
			const squad = await loadEntrySquadPicks(
				identity.session,
				identity.entryId,
				events
			)
			mySquadElementIds = squad.picks
				.map(pick => pick.elementId)
				.filter((id): id is number => id != null && id > 0)
			mySquadState = squad.state
		} catch (error) {
			console.error('[price-changes] squad seed failed:', error)
			mySquadState = 'unavailable'
		}
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
					eyebrow={t('eyebrow')}
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
				/>
			</div>
		</PageShell>
	)
}

export default async function PriceChangesPage(props: PageProps) {
	return withCapacityRunForRequest(() => renderPriceChangesPage(props))
}
