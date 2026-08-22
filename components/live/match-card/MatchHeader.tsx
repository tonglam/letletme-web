import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip'
import { useHydrated } from '@/hooks/use-hydrated'
import { teamCrestSrc } from '@/lib/team-crest'
import type { Match } from '@/types/match'
import { Activity, Clock, Eye, User } from 'lucide-react'
import Image from 'next/image'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { formatMatchKickoff } from './match-card-model'

type MatchTeam = Match['homeTeam']

function MatchStatus({ match }: { match: Match }) {
	const t = useTranslations('LiveMatches')
	if (match.status === 'LIVE') {
		return (
			<span
				className="inline-flex items-center gap-1.5 rounded-full bg-destructive/20 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-destructive"
				role="status"
			>
				<Activity className="size-3.5 animate-pulse" aria-hidden="true" />
				{t('liveMinute', { minute: match.minute })}
			</span>
		)
	}
	if (match.status === 'HT') {
		return (
			<span
				className="inline-flex items-center rounded-full bg-warning/20 px-2.5 py-0.5 text-xs font-semibold text-warning"
				role="status"
			>
				{t('halfTime')}
			</span>
		)
	}
	if (match.status === 'FT') {
		return (
			<span
				className="inline-flex items-center rounded-full bg-fascia-foreground/10 px-2.5 py-0.5 text-xs font-semibold text-fascia-foreground/70"
				role="status"
			>
				{match.provisional ? t('pendingFinal') : t('fullTime')}
			</span>
		)
	}
	if (match.status === 'NOT_STARTED') {
		return (
			<span
				className="inline-flex items-center rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-semibold text-warning"
				role="status"
			>
				{t('notStarted')}
			</span>
		)
	}
	return (
		<span
			className="inline-flex items-center rounded-full bg-info/15 px-2.5 py-0.5 text-xs font-semibold text-info"
			role="status"
		>
			{t('upcoming')}
		</span>
	)
}

function ManagerSummary({
	manager,
	align,
}: {
	manager: NonNullable<MatchTeam['manager']>
	align: 'left' | 'right'
}) {
	const t = useTranslations('LiveMatches')
	return (
		<div
			className={`flex items-center gap-1 text-xs text-muted-foreground ${align === 'right' ? 'justify-end' : ''}`}
		>
			<User className="size-3.5 shrink-0" aria-hidden="true" />
			<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						className="truncate rounded-sm underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-label={t('managerLabel', {
							team: manager.team,
							name: manager.name,
						})}
					>
						{manager.team}
					</button>
				</TooltipTrigger>
				<TooltipContent>
					<p>{manager.name}</p>
				</TooltipContent>
			</Tooltip>
			</TooltipProvider>
			<span className="shrink-0 font-medium tabular-nums text-primary-ink">
				{t('pointsShort', { points: manager.points })}
			</span>
		</div>
	)
}

function TeamSummary({
	team,
	side,
}: {
	team: MatchTeam
	side: 'home' | 'away'
}) {
	const logo = (
		<Image
			alt=""
			src={teamCrestSrc(team.shortName)}
			width={32}
			height={32}
			unoptimized
			className="size-8 shrink-0 object-contain md:size-9"
		/>
	)
	return (
		<div className={side === 'home' ? 'min-w-0 text-right' : 'min-w-0'}>
			<div
				className={`flex items-center gap-2 ${side === 'home' ? 'justify-end' : ''}`}
			>
				{side === 'home' ? (
					<>
						<span className="truncate font-display text-sm font-semibold tracking-tight md:text-base">
							{team.name}
						</span>
						{logo}
					</>
				) : (
					<>
						{logo}
						<span className="truncate font-display text-sm font-semibold tracking-tight md:text-base">
							{team.name}
						</span>
					</>
				)}
			</div>
			{team.manager ? (
				<div className="mt-2">
					<ManagerSummary
						manager={team.manager}
						align={side === 'home' ? 'right' : 'left'}
					/>
				</div>
			) : null}
		</div>
	)
}

export function MatchHeader({ match }: { match: Match }) {
	const locale = useLocale()
	const format = useFormatter()
	const hydrated = useHydrated()
	const kickoff = formatMatchKickoff(match.kickoff, locale, hydrated)
	return (
		<header className="flex flex-col gap-5">
			<div className="flex min-h-10 items-center justify-between gap-4 pr-24 text-sm text-muted-foreground">
				{kickoff ? (
					<span className="inline-flex items-center gap-1.5">
						<Clock className="size-3.5 shrink-0" aria-hidden="true" />
						{kickoff}
					</span>
				) : (
					<span />
				)}
				{match.viewers > 0 ? (
					<span className="inline-flex items-center gap-1.5">
						<Eye className="size-3.5 shrink-0" aria-hidden="true" />
						{format.number(match.viewers)}
					</span>
				) : null}
			</div>

			<div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
				<TeamSummary team={match.homeTeam} side="home" />
				<div className="scoreboard rounded-xl px-3 py-2.5 text-center sm:px-4 sm:py-3">
					<p className="mb-1.5 whitespace-nowrap font-display text-2xl font-bold tabular-nums tracking-tight text-electric sm:text-3xl">
						{match.homeTeam.score}
						<span className="mx-1 text-fascia-foreground/40">–</span>
						{match.awayTeam.score}
					</p>
					<div className="flex justify-center">
						<MatchStatus match={match} />
					</div>
				</div>
				<TeamSummary team={match.awayTeam} side="away" />
			</div>
		</header>
	)
}
