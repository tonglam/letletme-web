import type { TeamStatsViewModel } from '../_lib/team-stats-model'
import { useTranslations } from 'next-intl'

function chipLabel(
	raw: string | null | undefined,
	t: ReturnType<typeof useTranslations<'TeamStats'>>,
): string {
	const chip = String(raw ?? '')
		.toUpperCase()
		.replace(/[\s-]+/g, '_')
	if (chip === 'BB' || chip === 'BBOOST' || chip === 'BENCH_BOOST' || chip === 'BENCHBOOST') {
		return t('benchBoost')
	}
	if (
		chip === '3XC' ||
		chip === 'TC' ||
		chip === 'TRIPLE_CAPTAIN' ||
		chip === 'TRIPLECAPTAIN'
	) {
		return t('tripleCaptain')
	}
	if (chip === 'WC' || chip === 'WILDCARD') return t('wildcard')
	if (chip === 'FH' || chip === 'FREEHIT' || chip === 'FREE_HIT') return t('freeHit')
	if (chip === 'NONE' || chip === '' || chip === 'NULL' || chip === 'UNDEFINED') {
		return t('chipNone')
	}
	return raw ?? t('chipNone')
}

/**
 * Selected-gameweek scoreboard only — no season assets or identity.
 */
export function TeamGameweekOverall({ stats }: { stats: TeamStatsViewModel }) {
	const t = useTranslations('TeamStats')
	const eventChip = chipLabel(stats.eventChip, t)
	const captainLine =
		stats.eventPlayedCaptainName && stats.eventPlayedCaptainName !== 'N/A'
			? `${stats.eventPlayedCaptainName} (${stats.eventCaptainPoints})`
			: '—'

	return (
		<section
			className="scoreboard-lifted mb-5 rounded-xl sm:mb-6"
			aria-labelledby="team-gw-scoreboard-title"
		>
			<div className="border-b border-fascia-foreground/10 px-4 py-3 sm:px-5">
				<p
					id="team-gw-scoreboard-title"
					className="eyebrow text-electric/90"
				>
					{t('gameweekOverall')}
					<span className="ml-1.5 text-fascia-foreground/55">
						{t('eventScoreboard', { gameweek: stats.eventId })}
					</span>
				</p>
			</div>

			<div className="grid grid-cols-2 divide-x divide-fascia-foreground/10 border-b border-fascia-foreground/10">
				<div className="px-4 py-4 sm:px-5 sm:py-5">
					<p className="eyebrow text-fascia-foreground/55">
						{t('netPoints')}
					</p>
					<p className="mt-1 font-display text-3xl font-bold tabular-nums tracking-tight text-electric sm:text-4xl">
						{stats.eventNetPoints}
					</p>
				</div>
				<div className="px-4 py-4 sm:px-5 sm:py-5">
					<p className="eyebrow text-fascia-foreground/55">
						{t('gameweekPoints')}
					</p>
					<p className="mt-1 font-display text-3xl font-bold tabular-nums tracking-tight text-fascia-foreground sm:text-4xl">
						{stats.eventPoints}
					</p>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-px bg-fascia-foreground/10 sm:grid-cols-4">
				{(
					[
						{
							label: t('transferCost'),
							value:
								stats.eventTransfersCost > 0
									? `-${stats.eventTransfersCost}`
									: '0',
							destructive: stats.eventTransfersCost > 0,
						},
						{
							label: t('gameweekTransfers'),
							value: String(stats.eventTransfers),
						},
						{
							label: t('benchPoints'),
							value: String(stats.eventBenchPoints),
						},
						{
							label: t('playedCaptain'),
							value: captainLine,
						},
					] as const
				).map(item => (
					<div
						key={item.label}
						className="bg-scoreboard-cell px-3 py-3 sm:px-4 sm:py-3.5"
					>
						<p className="eyebrow text-fascia-foreground/50">
							{item.label}
						</p>
						<p
							className={`mt-1 truncate font-display text-sm font-semibold tracking-tight sm:text-base ${
								'destructive' in item && item.destructive
									? 'text-pink'
									: 'text-fascia-foreground'
							}`}
						>
							{item.value}
						</p>
					</div>
				))}
			</div>

			<div className="border-t border-fascia-foreground/10 px-3 py-3 sm:px-4">
				<div className="flex flex-wrap items-center gap-2">
					<span className="eyebrow text-fascia-foreground/50">
						{t('gameweekChip')}
					</span>
					<span className="rounded-md border border-fascia-foreground/12 bg-fascia-foreground/8 px-2.5 py-1 font-display text-caption font-semibold uppercase tracking-[0.1em] text-electric">
						{eventChip}
					</span>
				</div>
			</div>
		</section>
	)
}
