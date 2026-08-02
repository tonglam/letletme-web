import { Badge } from '@/components/ui/badge'
import { Link } from '@/i18n/navigation'
import { Gamepad, QrCode } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

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
		<footer className="mt-16 border-t bg-card/60">
			<div className="mx-auto w-full max-w-6xl px-4 py-12 lg:px-8">
				<div className="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
					<div className="flex items-center gap-3">
						<span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
							<Gamepad aria-hidden="true" className="size-5" />
						</span>
						<div>
							<p className="font-display text-lg font-bold tracking-tight">LetLetMe</p>
							<p className="text-sm text-muted-foreground">{t('tagline')}</p>
						</div>
					</div>
					<Badge variant="outline" className="w-fit gap-2 py-1.5">
						<QrCode aria-hidden="true" className="size-4" />
						{t('miniProgram')}
					</Badge>
				</div>

				<nav aria-label={t('navigation')} className="grid grid-cols-2 gap-8 sm:grid-cols-4">
					{footerGroups.map(group => (
						<div key={group.labelKey}>
							<p className="mb-3 text-sm font-semibold text-foreground">{t(group.labelKey)}</p>
							<ul className="flex flex-col gap-2.5">
								{group.links.map(link => (
									<li key={link.href}>
										<Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
											{t(link.labelKey)}
										</Link>
									</li>
								))}
							</ul>
						</div>
					))}
				</nav>

				<div className="mt-10 flex flex-col gap-2 border-t pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
					<p>{t('rights', { year: currentYear })}</p>
					<p>{t('builtFor')}</p>
				</div>
			</div>
		</footer>
	)
}
