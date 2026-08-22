import {
	Compass,
	DivideIcon as LucideIcon,
	Medal,
	Newspaper,
	Timer,
	UserRound,
} from 'lucide-react'
import { isBriefingPublicEnabled } from '@/lib/briefing-public'

interface MenuItem {
	id: string
	labelKey: 'live' | 'briefing' | 'myFpl' | 'competitions' | 'explore'
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
			| 'createCompetition'
			| 'gameweek'
			| 'fixtures'
			| 'market'
			| 'priceChanges'
			| 'trends'
			| 'players'
		href: string
	}[]
}

/**
 * The public information architecture has five sections:
 *   Live / Briefing / My FPL / Competitions / Explore.
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
			{ labelKey: 'liveMatches', href: '/live/matches' },
		],
	},
	{
		id: 'briefing',
		labelKey: 'briefing',
		icon: Newspaper,
		directHref: '/briefing/week',
		items: [{ labelKey: 'briefingWeek', href: '/briefing/week' }],
	},
	{
		id: 'myFpl',
		labelKey: 'myFpl',
		icon: UserRound,
		items: [
			{ labelKey: 'myFplTeam', href: '/my-fpl/team' },
			{ labelKey: 'myTournament', href: '/my-fpl/competitions' },
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
			{ labelKey: 'priceChanges', href: '/explore/price-changes' },
			{ labelKey: 'trends', href: '/explore/selections' },
			{ labelKey: 'players', href: '/explore/player-stats' },
		],
	},
]

export const menuItems: MenuItem[] = isBriefingPublicEnabled()
	? allMenuItems
	: allMenuItems.filter(item => item.id !== 'briefing')
