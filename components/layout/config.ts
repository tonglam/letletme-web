import {
	Compass,
	DivideIcon as LucideIcon,
	Medal,
	Timer,
	UserRound,
} from 'lucide-react'

interface MenuItem {
	id: string
	labelKey: 'live' | 'myFpl' | 'competitions' | 'explore'
	icon: typeof LucideIcon
	items: {
		labelKey:
			| 'livePoints'
			| 'liveCompetitions'
			| 'liveMatches'
			| 'myFplOverview'
			| 'myFplTeam'
			| 'myCompetitions'
			| 'createCompetition'
			| 'gameweek'
			| 'fixtures'
			| 'market'
			| 'trends'
			| 'players'
		href: string
	}[]
}

/**
 * The public information architecture has four sections:
 *   Live / My FPL / Competitions / Explore.
 *
 * These names are the only public navigation vocabulary. Internal component
 * names may continue to describe the underlying data model.
 */
export const menuItems: MenuItem[] = [
	{
		id: 'live',
		labelKey: 'live',
		icon: Timer,
		items: [
			{ labelKey: 'livePoints', href: '/live/points' },
			{ labelKey: 'liveCompetitions', href: '/live/competitions' },
			{ labelKey: 'liveMatches', href: '/live/matches' },
		],
	},
	{
		id: 'myFpl',
		labelKey: 'myFpl',
		icon: UserRound,
		items: [
			{ labelKey: 'myFplOverview', href: '/' },
			{ labelKey: 'myFplTeam', href: '/my-fpl/team' },
		],
	},
	{
		id: 'competitions',
		labelKey: 'competitions',
		icon: Medal,
		items: [
			{ labelKey: 'myCompetitions', href: '/competitions/browse?mine=true' },
			{ labelKey: 'createCompetition', href: '/competitions/create' },
		],
	},
	{
		id: 'explore',
		labelKey: 'explore',
		icon: Compass,
		items: [
			{ labelKey: 'gameweek', href: '/explore/gameweek' },
			{ labelKey: 'fixtures', href: '/explore/fixtures' },
			{ labelKey: 'market', href: '/explore/market' },
			{ labelKey: 'trends', href: '/explore/selections' },
			{ labelKey: 'players', href: '/explore/player-stats' },
		],
	},
]
