import {
	BarChart2,
	DivideIcon as LucideIcon,
	Medal,
	Timer,
	Trophy
} from 'lucide-react'

interface MenuItem {
	id: string
	label: string
	icon: typeof LucideIcon
	items: {
		label: string
		href?: string
	}[]
}

export const menuItems: MenuItem[] = [
	{
		id: 'live',
		label: 'Live',
		icon: Timer,
		items: [
			{ label: 'Live Points', href: '/live/points' },
			{ label: 'Live Tournaments', href: '/live/tournament' },
			{ label: 'Live Matches', href: '/live/matches' }
		]
	},
	{
		id: 'tournament',
		label: 'Tournament',
		icon: Medal,
		items: [
			{ label: 'My Tournaments', href: '/tournament/list?mine=true' },
			{ label: 'Create Tournaments', href: '/tournament/create' }
		]
	},
	{
		id: 'stats',
		label: 'Stats',
		icon: Trophy,
		items: [
			{ label: 'Gameweek Stats', href: '/stats/gameweek' },
			{ label: 'Team Stats', href: '/stats/team' },
			{ label: 'Tournament Stats', href: '/stats/tournament' }
		]
	},
	{
		id: 'data',
		label: 'Data',
		icon: BarChart2,
		items: [
			{ label: 'Price Changes', href: '/data/price-changes' },
			{ label: 'Selections', href: '/data/selections' },
			{ label: 'Player Stats', href: '/data/player-stats' },
			{ label: 'Team Stats', href: '/data/team-stats' }
		]
	}
]
