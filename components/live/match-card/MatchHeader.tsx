import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Match } from '@/types/match'
import { Activity, Clock, Eye, User } from 'lucide-react'
import Image from 'next/image'
import { formatMatchKickoff } from './match-card-model'

type MatchTeam = Match['homeTeam']

function MatchStatus({ match }: { match: Match }) {
	if (match.status === 'LIVE') {
		return (
			<span className="inline-flex items-center gap-1 font-medium text-destructive" role="status">
				<Activity className="animate-pulse" aria-hidden="true" /> {match.minute}&apos; live
			</span>
		)
	}
	if (match.status === 'HT') return <span className="font-medium text-warning" role="status">Half time</span>
	if (match.status === 'FT') return <span className="font-medium text-muted-foreground" role="status">Full time</span>
	if (match.status === 'NOT_STARTED') return <span className="font-medium text-warning" role="status">Not started</span>
	return <span className="font-medium text-info" role="status">Upcoming</span>
}

function ManagerSummary({ manager, align }: { manager: NonNullable<MatchTeam['manager']>; align: 'left' | 'right' }) {
	return (
		<div className={`flex items-center gap-1 text-xs text-muted-foreground ${align === 'right' ? 'justify-end' : ''}`}>
			<User aria-hidden="true" />
			<Tooltip>
				<TooltipTrigger asChild>
					<button type="button" className="truncate rounded-sm underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${manager.team}, managed by ${manager.name}`}>
						{manager.team}
					</button>
				</TooltipTrigger>
				<TooltipContent><p>{manager.name}</p></TooltipContent>
			</Tooltip>
			<span className="shrink-0 font-medium text-primary">{manager.points} pts</span>
		</div>
	)
}

function TeamSummary({ team, side }: { team: MatchTeam; side: 'home' | 'away' }) {
	const logo = <Image alt="" src={`/images/team-logos/${team.shortName.toUpperCase()}.png`} width={32} height={32} className="size-8 shrink-0 object-contain" />
	return (
		<div className={side === 'home' ? 'min-w-0 text-right' : 'min-w-0'}>
			<div className={`flex items-center gap-2 ${side === 'home' ? 'justify-end' : ''}`}>
				{side === 'home' ? <><span className="truncate font-semibold">{team.name}</span>{logo}</> : <>{logo}<span className="truncate font-semibold">{team.name}</span></>}
			</div>
			{team.manager ? <div className="mt-2"><ManagerSummary manager={team.manager} align={side === 'home' ? 'right' : 'left'} /></div> : null}
		</div>
	)
}

export function MatchHeader({ match }: { match: Match }) {
	const kickoff = formatMatchKickoff(match.kickoff)
	return (
		<header className="flex flex-col gap-6">
			<div className="flex min-h-10 items-center justify-between gap-4 pr-24 text-sm text-muted-foreground">
				{kickoff ? <span className="inline-flex items-center gap-1.5"><Clock aria-hidden="true" />{kickoff}</span> : <span />}
				{match.viewers > 0 ? <span className="inline-flex items-center gap-1.5"><Eye aria-hidden="true" />{new Intl.NumberFormat().format(match.viewers)}</span> : null}
			</div>

			<div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
				<TeamSummary team={match.homeTeam} side="home" />
				<div className="rounded-lg bg-background px-3 py-2 text-center shadow-sm sm:px-4">
					<p className="mb-1 whitespace-nowrap text-2xl font-bold">{match.homeTeam.score} – {match.awayTeam.score}</p>
					<div className="flex justify-center text-sm"><MatchStatus match={match} /></div>
				</div>
				<TeamSummary team={match.awayTeam} side="away" />
			</div>
		</header>
	)
}
