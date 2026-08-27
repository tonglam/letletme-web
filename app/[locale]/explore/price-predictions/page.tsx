import { PriceChangesBoard } from '@/app/data/price-changes/PriceChangesBoard'
import PageShell from '@/components/layout/PageShell'
import { LocalSnapshotTime } from '@/components/stats/LocalSnapshotTime'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { Badge } from '@/components/ui/badge'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { withCapacityRunForRequest } from '@/lib/capacity-run'
import { getCurrentAndNextEvents } from '@/lib/events'
import { EMPTY_PRICE_CHANGE_BOARD } from '@/lib/graphql/operations/price-changes'
import { computeTimeLeft } from '@/lib/home-deadline'
import { loadPriceChangeBoard } from '@/lib/price-change-server'
import { loadEntrySquadPicks } from '@/lib/load-entry-squad-picks'
import type {
	EntrySquadPicksResult,
	SquadLoadState,
	SquadPickSeed
} from '@/lib/squad-picks'
import { getVerifiedEntryContext } from '@/lib/session'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/explore/price-predictions',
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

function PriceChangesContractMarker({
	status,
	revision,
	expected,
	observed
}: {
	status: 'READY' | 'STALE' | 'UNAVAILABLE'
	revision: string
	expected: number
	observed: number
}) {
	return (
		<span
			hidden
			data-letletme-contract="price_changes"
			data-status={status}
			data-revision={revision}
			data-expected={String(expected)}
			data-observed={String(observed)}
		/>
	)
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

	const board = boardResponse.priceChangeBoard
	const deadlineMs = board.deadline ? Date.parse(board.deadline) : NaN
	const initialTimeLeft = computeTimeLeft(
		Number.isFinite(deadlineMs) ? deadlineMs : null
	)
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
			<PriceChangesContractMarker
				status={
					board.status === 'READY'
						? 'READY'
						: board.status === 'STALE' || board.status === 'PARTIAL'
							? 'STALE'
							: 'UNAVAILABLE'
				}
				revision={board.revision || 'unavailable'}
				expected={board.expectedPlayerCount}
				observed={board.observedPlayerCount}
			/>
			<div className="container mx-auto max-w-6xl px-4 py-8">
				<StatsPageHeader
					title={t('title')}
					badge={
						<div className="flex flex-col items-end gap-1">
							<Badge
								variant="outline"
								className={statusBadgeClass(board.status)}
							>
								{statusLabel}
							</Badge>
							<LocalSnapshotTime
								value={board.fetchedAt}
								label={t('snapshotUpdatedAt')}
								locale={locale}
								dateOnly
							/>
						</div>
					}
				/>
				<PriceChangesBoard
					board={board}
					locale={locale}
					initialTimeLeft={initialTimeLeft}
					mySquadElementIds={mySquadElementIds}
					mySquadPicks={mySquadPicks}
					mySquadState={mySquadState}
				/>
			</div>
		</PageShell>
	)
}

export default async function PriceChangesPage(props: PageProps) {
	return withCapacityRunForRequest(() => renderPriceChangesPage(props))
}
