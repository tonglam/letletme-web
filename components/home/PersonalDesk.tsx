import { PersonalLeagueRankList } from '@/components/home/PersonalLeagueRankList'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Link } from '@/i18n/navigation'
import type { Session } from '@/lib/auth'
import { executeServerQueryWithSession } from '@/lib/graphql-server'
import {
	GET_ENTRY,
	type EntrySummaryResponse
} from '@/lib/graphql/operations/entries'
import {
	GET_ENTRY_OFFICIAL_H2H_DESK,
	type EntryOfficialH2HDeskResponse,
} from '@/lib/graphql/operations/tournaments'
import {
	GET_ENTRY_LEAGUES,
	type EntryLeague,
	type EntryLeaguesResponse
} from '@/lib/graphql/operations/leagues'
import { buildHomeLeagueRankRows } from '@/lib/home-league-ranks'
import { formatCompactNumber, formatInteger } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Suspense, type ReactNode } from 'react'

function PersonalDeskShell({
	accent = 'default',
	children
}: {
	accent?: 'default' | 'warning'
	children: ReactNode
}) {
	const ringClass =
		accent === 'warning' ? 'border-pink/35' : 'border-foreground/10'

	return (
		<article
			className={`overflow-hidden rounded-xl border bg-card p-4 shadow-sticker-sm sm:p-5 ${ringClass}`}
			data-home-personal-ready="true"
		>
			{children}
		</article>
	)
}

async function LeagueRankSection({
	desk,
	entryId,
	leagues,
}: {
	desk: EntryOfficialH2HDeskResponse['entryOfficialH2HDesk']
	entryId: number
	leagues: EntryLeague[]
}) {
	const t = await getTranslations('Home')
	const rows = buildHomeLeagueRankRows(leagues, desk)

	return (
		<div className="mt-4 border-t border-border/50 pt-3">
			<div className="mb-2 flex items-center justify-between gap-2">
				<p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
					{t('personalLeaguesTitle')}
				</p>
				{rows.length > 0 ? (
					<p className="text-[11px] tabular-nums text-muted-foreground">
						{t('personalLeaguesCount', { count: rows.length })}
					</p>
				) : null}
			</div>
			<PersonalLeagueRankList entryId={entryId} rows={rows} />
		</div>
	)
}

function PersonalDeskLeaguesFallback() {
	return (
		<div
			className="mt-4 space-y-2 border-t border-border/50 pt-3"
			aria-hidden="true"
		>
			<Skeleton className="h-3 w-20" />
			<Skeleton className="h-11 w-full" />
			<Skeleton className="h-11 w-full" />
			<Skeleton className="h-11 w-full" />
		</div>
	)
}

async function PersonalDeskLeagues({
	deskPromise,
	entryId,
	leaguesPromise
}: {
	deskPromise: Promise<EntryOfficialH2HDeskResponse | null>
	entryId: number
	leaguesPromise: Promise<EntryLeaguesResponse | null>
}) {
	const [leaguesData, deskData, t] = await Promise.all([
		leaguesPromise,
		deskPromise,
		getTranslations('Home')
	])

	if (!leaguesData) {
		return (
			<div className="mt-4 border-t border-border/50 pt-3">
				<p className="text-xs text-muted-foreground">
					{t('personalLeaguesUnavailable')}
				</p>
			</div>
		)
	}

	return (
		<LeagueRankSection
			desk={deskData?.entryOfficialH2HDesk ?? []}
			entryId={entryId}
			leagues={leaguesData.entryLeagues ?? []}
		/>
	)
}

export async function PersonalDeskBindPrompt() {
	const t = await getTranslations('Home')

	return (
		<PersonalDeskShell accent="warning">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div className="min-w-0 max-w-xl">
					<p className="font-display text-lg font-bold uppercase tracking-wide sm:text-xl">
						{t('bindEntryTitle')}
					</p>
					<p className="mt-1.5 text-sm leading-6 text-muted-foreground">
						{t('bindEntryPrompt')}
					</p>
				</div>
				<Button
					className="min-h-11 shrink-0 font-display font-semibold uppercase tracking-[0.1em]"
					asChild
				>
					<Link href="/onboarding/bind-entry" prefetch={false}>
						{t('bindEntryCta')}
						<ArrowRight data-icon="inline-end" />
					</Link>
				</Button>
			</div>
		</PersonalDeskShell>
	)
}

/**
 * Bound-entry personal desk: metrics + FPL league ranks (vs last week).
 */
export async function PersonalDesk({
	entryId,
	session
}: {
	entryId: number
	session: Session | null
}) {
	let teamName: string | null = null
	let managerName: string | null = null
	let overallPoints: number | null = null
	let overallRank: number | null = null
	let teamValue: number | null = null

	const entryPromise = executeServerQueryWithSession<EntrySummaryResponse>(
		session,
		GET_ENTRY,
		{ id: entryId },
		{ cache: 'no-store', timeoutMs: 4_000 }
	).catch(err => {
		console.error('[home-personal-desk] entry fetch failed:', err)
		return null
	})
	// Start both Home operations before awaiting either one. Entry summary can
	// stream first while league ranks remain behind their own Suspense boundary.
	const leaguesPromise = executeServerQueryWithSession<EntryLeaguesResponse>(
		session,
		GET_ENTRY_LEAGUES,
		{ entryId },
		{ cache: 'no-store', timeoutMs: 4_000 }
	).catch(err => {
		console.error('[home-personal-desk] leagues fetch failed:', err)
		return null
	})
	const deskPromise = executeServerQueryWithSession<EntryOfficialH2HDeskResponse>(
		session,
		GET_ENTRY_OFFICIAL_H2H_DESK,
		{ entryId },
		{ cache: 'no-store', timeoutMs: 4_000 },
	).catch(err => {
		console.error('[home-personal-desk] official H2H desk fetch failed:', err)
		return null
	})

	const [entryData, t] = await Promise.all([
		entryPromise,
		getTranslations('Home')
	])

	const entry = entryData?.entry
	if (entry) {
		teamName = entry.entryName?.trim() || null
		managerName = entry.playerName?.trim() || null
		overallPoints =
			typeof entry.overallPoints === 'number' ? entry.overallPoints : null
		overallRank =
			typeof entry.overallRank === 'number' ? entry.overallRank : null
		teamValue = typeof entry.teamValue === 'number' ? entry.teamValue : null
	}

	const metricTiles = [
		{
			label: t('personalPointsLabel'),
			value: overallPoints == null ? '—' : formatInteger(overallPoints)
		},
		{
			label: t('personalRankLabel'),
			value: overallRank == null ? '—' : formatCompactNumber(overallRank)
		},
		{
			label: t('personalTeamValueLabel'),
			value: teamValue == null ? '—' : `£${(teamValue / 10).toFixed(1)}m`
		}
	] as const

	return (
		<PersonalDeskShell>
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
				<div className="min-w-0 sm:max-w-[16rem] sm:shrink-0">
					<p className="truncate font-display text-xl font-bold uppercase leading-tight tracking-wide">
						{teamName || t('teamNameFallback')}
					</p>
					<p className="mt-1 truncate text-sm text-muted-foreground">
						<span className="sr-only">{t('personalManagerLabel')}: </span>
						{managerName || '—'}
					</p>
				</div>

				<div className="grid min-w-0 flex-1 grid-cols-3 gap-px overflow-hidden rounded-lg border border-foreground/10 bg-foreground/10">
					{metricTiles.map(tile => (
						<div
							key={tile.label}
							className="bg-background px-2 py-2.5 text-center sm:px-3 sm:py-3"
						>
							<p className="font-mono text-base font-semibold tabular-nums tracking-tight text-primary-ink sm:text-lg">
								{tile.value}
							</p>
							<p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
								{tile.label}
							</p>
						</div>
					))}
				</div>
			</div>
			{!entryData?.entry ? (
				<p className="mt-3 text-xs text-muted-foreground">
					{t('personalDataUnavailable')}
				</p>
			) : null}

			<Suspense fallback={<PersonalDeskLeaguesFallback />}>
				<PersonalDeskLeagues
					deskPromise={deskPromise}
					entryId={entryId}
					leaguesPromise={leaguesPromise}
				/>
			</Suspense>
		</PersonalDeskShell>
	)
}
