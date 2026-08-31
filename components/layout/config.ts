import {
	Compass,
	Database,
	DivideIcon as LucideIcon,
	Medal,
	Newspaper,
	Timer,
	UserRound
} from 'lucide-react'

interface MenuItem {
	id: string
	labelKey: 'live' | 'briefing' | 'myFpl' | 'competitions' | 'explore' | 'data'
	icon: typeof LucideIcon
	directHref?: string
	items: {
		labelKey:
			| 'briefingWeek'
			| 'livePoints'
			| 'liveCompetitions'
			| 'liveMatches'
			| 'myFplTeam'
			| 'myTournament'
			| 'myCompetitions'
			| 'browseCompetitions'
			| 'createCompetition'
			| 'gameweek'
			| 'fixtures'
			| 'market'
			| 'pricePredictions'
			| 'trends'
			| 'players'
		href: string
	}[]
}

/**
 * The public information architecture has five visible sections:
 *   Live / My FPL / Competitions / Explore / Data.
 *
 * These names are the only public navigation vocabulary. Internal component
 * names may continue to describe the underlying data model.
 */
const allMenuItems: MenuItem[] = [
	{
		id: 'live',
		labelKey: 'live',
		icon: Timer,
		items: [
			{ labelKey: 'livePoints', href: '/live/points' },
			{ labelKey: 'liveCompetitions', href: '/live/competitions' },
			{ labelKey: 'liveMatches', href: '/live/matches' }
		]
	},
	{
		id: 'briefing',
		labelKey: 'briefing',
		icon: Newspaper,
		directHref: '/briefing/week',
		items: [{ labelKey: 'briefingWeek', href: '/briefing/week' }]
	},
	{
		id: 'myFpl',
		labelKey: 'myFpl',
		icon: UserRound,
		items: [
			{ labelKey: 'myFplTeam', href: '/my-fpl/team' },
			{ labelKey: 'myTournament', href: '/my-fpl/competitions' }
		]
	},
	{
		id: 'competitions',
		labelKey: 'competitions',
		icon: Medal,
		items: [
			{ labelKey: 'browseCompetitions', href: '/competitions/browse' },
			{ labelKey: 'createCompetition', href: '/competitions/create' }
		]
	},
	{
		id: 'explore',
		labelKey: 'explore',
		icon: Compass,
		items: [
			{ labelKey: 'gameweek', href: '/explore/gameweek' },
			{ labelKey: 'fixtures', href: '/explore/fixtures' },
			{ labelKey: 'market', href: '/explore/market' },
			{ labelKey: 'pricePredictions', href: '/explore/price-predictions' },
			{ labelKey: 'trends', href: '/explore/selections' }
		]
	},
	{
		id: 'data',
		labelKey: 'data',
		icon: Database,
		items: [{ labelKey: 'players', href: '/explore/player-stats' }]
	}
]

// Keep the briefing routes available while the public navigation entry is
// temporarily hidden. Re-enable this item here when the menu is ready to
// expose the briefing surface again.
export const menuItems: MenuItem[] = allMenuItems.filter(
	item => item.id !== 'briefing'
)
