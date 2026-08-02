import { Link } from '@/i18n/navigation'
import { QrCode } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { LogoMark, LogoWordmark } from './Logo'

const footerGroups = [
	{
		labelKey: 'fplData',
		links: [
			{ labelKey: 'playerStats', href: '/data/player-stats' },
			{ labelKey: 'priceChanges', href: '/data/price-changes' },
		],
	},
	{
		labelKey: 'live',
		links: [
			{ labelKey: 'livePoints', href: '/live/points' },
			{ labelKey: 'tournaments', href: '/live/tournament' },
			{ labelKey: 'matches', href: '/live/matches' },
		],
	},
	{
		labelKey: 'analysis',
		links: [
			{ labelKey: 'gameweekStats', href: '/stats/gameweek' },
			{ labelKey: 'teamStats', href: '/stats/team' },
			{ labelKey: 'tournamentStats', href: '/stats/tournament' },
		],
	},
	{
		labelKey: 'tournaments',
		links: [
			{ labelKey: 'myTournaments', href: '/tournament/list?mine=true' },
			{ labelKey: 'createTournament', href: '/tournament/create' },
			{ labelKey: 'liveStandings', href: '/live/tournament' },
		],
	},
] as const

export async function Footer() {
	const t = await getTranslations('Footer')
	const currentYear = new Date().getFullYear()

	return (
		<footer className="fascia texture-grain relative mt-16 border-t-2 border-electric">
			<div className="mx-auto w-full max-w-6xl px-4 py-12 lg:px-8">
				<div className="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
					<div className="flex items-center gap-3">
						<LogoMark className="size-11 text-electric" />
						<div>
							<LogoWordmark className="text-lg" />
							<p className="mt-1 text-sm text-fascia-foreground/60">{t('tagline')}</p>
						</div>
					</div>
					<span className="inline-flex w-fit items-center gap-2 rounded-md border border-electric/40 bg-white/5 px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-[0.18em] text-fascia-foreground/80">
						<QrCode aria-hidden="true" className="size-4 text-electric" />
						{t('miniProgram')}
					</span>
				</div>

				<nav
					aria-label={t('navigation')}
					className="grid grid-cols-2 gap-8 border-t border-white/10 pt-8 sm:grid-cols-4"
				>
					{footerGroups.map(group => (
						<div key={group.labelKey}>
							<p className="chyron mb-4 !text-fascia-foreground/70">{t(group.labelKey)}</p>
							<ul className="flex flex-col gap-2.5">
								{group.links.map(link => (
									<li key={link.href}>
										<Link
											href={link.href}
											className="text-sm text-fascia-foreground/60 underline-offset-4 transition-colors hover:text-electric hover:underline"
										>
											{t(link.labelKey)}
										</Link>
									</li>
								))}
							</ul>
						</div>
					))}
				</nav>

				<div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-sm text-fascia-foreground/50 sm:flex-row sm:items-center sm:justify-between">
					<p>{t('rights', { year: currentYear })}</p>
					<p className="font-display text-xs font-semibold uppercase tracking-[0.18em]">
						{t('builtFor')}
					</p>
				</div>
			</div>
		</footer>
	)
}
