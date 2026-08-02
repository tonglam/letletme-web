import {
	BarChart2,
	DivideIcon as LucideIcon,
	Medal,
	Timer,
	Trophy
} from 'lucide-react'

interface MenuItem {
	id: string
	labelKey: 'live' | 'tournament' | 'stats' | 'data'
	icon: typeof LucideIcon
	items: {
		labelKey:
			| 'livePoints'
			| 'liveTournaments'
			| 'liveMatches'
			| 'myTournaments'
			| 'createTournaments'
			| 'gameweekStats'
			| 'teamStats'
			| 'tournamentStats'
			| 'priceChanges'
			| 'selections'
			| 'playerStats'
		href: string
	}[]
}

export const menuItems: MenuItem[] = [
	{
		id: 'live',
		labelKey: 'live',
		icon: Timer,
		items: [
			{ labelKey: 'livePoints', href: '/live/points' },
			{ labelKey: 'liveTournaments', href: '/live/tournament' },
			{ labelKey: 'liveMatches', href: '/live/matches' }
		]
	},
	{
		id: 'tournament',
		labelKey: 'tournament',
		icon: Medal,
		items: [
			{ labelKey: 'myTournaments', href: '/tournament/list?mine=true' },
			{ labelKey: 'createTournaments', href: '/tournament/create' }
		]
	},
	{
		id: 'stats',
		labelKey: 'stats',
		icon: Trophy,
		items: [
			{ labelKey: 'gameweekStats', href: '/stats/gameweek' },
			{ labelKey: 'teamStats', href: '/stats/team' },
			{ labelKey: 'tournamentStats', href: '/stats/tournament' }
		]
	},
	{
		id: 'data',
		labelKey: 'data',
		icon: BarChart2,
		items: [
			{ labelKey: 'priceChanges', href: '/data/price-changes' },
			{ labelKey: 'selections', href: '/data/selections' },
			{ labelKey: 'playerStats', href: '/data/player-stats' }
		]
	}
]
