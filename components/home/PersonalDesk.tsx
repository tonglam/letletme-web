import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import { PersonalDeskRetry } from '@/components/home/PersonalDeskRetry'
import { PersonalLeagueRankList } from '@/components/home/PersonalLeagueRankList'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import type { Session } from '@/lib/auth'
import { type HomePersonalDesk } from '@/lib/graphql/operations/home'
import { loadHomePersonalDesk } from '@/lib/home-data-server'
import { formatCompactNumber, formatInteger } from '@/lib/utils'
import type { SeasonPresentation } from '@/lib/season-presentation'
import { ArrowRight } from 'lucide-react'
import { getFormatter, getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'

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
			className={`min-h-[25rem] overflow-hidden rounded-xl border bg-card p-4 shadow-sticker-sm sm:p-5 ${ringClass}`}
		>
			{children}
		</article>
	)
}

export async function PersonalDeskBindPrompt() {
	const t = await getTranslations('Home')

	return (
		<PersonalDeskShell accent="warning">
			<div className="flex min-h-[21rem] flex-col justify-center gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div className="min-w-0 max-w-xl">
					<p className="font-display text-lg font-bold uppercase tracking-wide sm:text-xl">
						{t('bindEntryTitle')}
					</p>
					<p className="mt-1.5 text-sm leading-6 text-muted-foreground">
						{t('bindEntryPrompt')}
					</p>
				</div>
				<Button
					className="min-h-11 shrink-0 font-display font-semibold uppercase tracking-caps"
					asChild
				>
					<Link
						href="/onboarding/bind-entry"
						prefetch={false}
					>
						{t('bindEntryCta')}
						<ArrowRight data-icon="inline-end" />
					</Link>
				</Button>
			</div>
		</PersonalDeskShell>
	)
}

function PersonalDeskUnavailable({ message }: { message: string }) {
	return (
		<PersonalDeskShell>
			<div
				className="flex min-h-[21rem] flex-col items-center justify-center gap-4 text-center"
				data-home-personal-ready="unavailable"
			>
				<p
					className="max-w-md text-sm text-muted-foreground"
					{...{ elementtiming: 'home-team-desk' }}
				>
					{message}
				</p>
				<PersonalDeskRetry />
			</div>
			<RouteReadyMarker
				name="HOME_TEAM_DESK_READY"
				elementTiming="home-team-desk"
				audienceHint="session-hint"
				goodMs={500}
				poorMs={1_000}
			/>
		</PersonalDeskShell>
	)
}

function metricTiles(
	desk: HomePersonalDesk,
	labels: { points: string; rank: string; value: string },
	options?: { hideSeasonMetrics?: boolean }
) {
	return [
		{
			label: labels.points,
			value:
				options?.hideSeasonMetrics || desk.overallPoints == null
					? '—'
					: formatInteger(desk.overallPoints)
		},
		{
			label: labels.rank,
			value:
				options?.hideSeasonMetrics || desk.overallRank == null
					? '—'
					: formatCompactNumber(desk.overallRank)
		},
		{
			label: labels.value,
			value:
				desk.teamValue == null ? '—' : `£${(desk.teamValue / 10).toFixed(1)}m`
		}
	] as const
}

/** Bound-entry summary and compact league ranks, committed as one RSC result. */
export async function PersonalDesk({
	session,
	presentation
}: {
	session: Session | null
	presentation: SeasonPresentation
}) {
	const [result, t, format] = await Promise.all([
		loadHomePersonalDesk(session),
		getTranslations('Home'),
		getFormatter()
	])

	const desk = result?.homePersonalDesk ?? null
	if (!desk || desk.state === 'UNAVAILABLE') {
		return <PersonalDeskUnavailable message={t('personalDataUnavailable')} />
	}

	const tiles = metricTiles(desk, {
		points: t('personalPointsLabel'),
		rank: t('personalRankLabel'),
		value: t('personalTeamValueLabel')
	}, {
		hideSeasonMetrics:
			desk.state === 'EMPTY' && presentation.phase === 'PRESEASON'
	})
	const readyKey = `${desk.sourceCheckedAt ?? 'unknown'}:${desk.state}`
	const staleDate = desk.sourceCheckedAt
		? new Date(desk.sourceCheckedAt)
		: null
	const staleDateLabel = staleDate && !Number.isNaN(staleDate.getTime())
		? format.dateTime(staleDate, { dateStyle: 'medium', timeStyle: 'short' })
		: t('personalDataLastSyncUnknown')

	return (
		<PersonalDeskShell>
			<div
				data-home-personal-ready="true"
				data-home-personal-state={desk.state}
			>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
					<div className="min-w-0 sm:max-w-[16rem] sm:shrink-0">
						<p
							className="truncate font-display text-xl font-bold uppercase leading-tight tracking-wide"
							{...{ elementtiming: 'home-team-desk' }}
						>
							{desk.entryName?.trim() || t('teamNameFallback')}
						</p>
						<p className="mt-1 truncate text-sm text-muted-foreground">
							<span className="sr-only">{t('personalManagerLabel')}: </span>
							{desk.playerName?.trim() || '—'}
						</p>
					</div>

					<div className="grid min-w-0 flex-1 grid-cols-3 gap-px overflow-hidden rounded-lg border border-foreground/10 bg-foreground/10">
						{tiles.map(tile => (
							<div
								key={tile.label}
								className="bg-background px-2 py-2.5 text-center sm:px-3 sm:py-3"
							>
								<p className="font-display text-base font-semibold tabular-nums tracking-tight text-primary-ink sm:text-lg">
									{tile.value}
								</p>
								<p className="mt-0.5 eyebrow">{tile.label}</p>
							</div>
						))}
					</div>
				</div>

				{desk.state === 'STALE' ? (
					<p className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-muted-foreground">
						{t('personalDataStale', { date: staleDateLabel })}
					</p>
				) : null}

				{desk.state === 'EMPTY' ? (
					<p className="mt-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
						{presentation.phase === 'PRESEASON'
							? t('personalDataPreseason')
							: t('personalDataEmpty')}
					</p>
				) : null}

				<div className="mt-4 border-t border-border/50 pt-3">
					<p className="mb-2 eyebrow">{t('personalLeaguesTitle')}</p>
					<PersonalLeagueRankList
						rows={desk.leagueRanks}
						readyKey={readyKey}
					/>
				</div>
			</div>
			<RouteReadyMarker
				name="HOME_TEAM_DESK_READY"
				readyKey={readyKey}
				elementTiming="home-team-desk"
				audienceHint="session-hint"
				goodMs={500}
				poorMs={1_000}
			/>
		</PersonalDeskShell>
	)
}
