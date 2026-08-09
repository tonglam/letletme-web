import {
	BarChart2,
	DivideIcon as LucideIcon,
	Medal,
	Timer,
	UserRound,
} from 'lucide-react'

interface MenuItem {
	id: string
	labelKey: 'live' | 'me' | 'tournament' | 'data'
	icon: typeof LucideIcon
	items: {
		labelKey:
			| 'livePoints'
			| 'liveTournaments'
			| 'liveMatches'
			| 'myTournaments'
			| 'createTournaments'
			| 'gameweekStats'
			| 'fixtures'
			| 'teamStats'
			| 'tournamentStats'
			| 'priceChanges'
			| 'selections'
			| 'playerStats'
		href: string
	}[]
}

/**
 * Primary IA — menu labels stay noun phrases (not bare verbs):
 *   Live — Live Points / Live Tournaments / Live Matches
 *   Me — My Team / My Tournament  (personal “My …” review)
 *   Tournament — New tournament / Browse tournaments  (ops pair)
 *   Data — Gameweek / Fixtures / Market / League Trends / Player Stats
 *
 * Me “My Tournament” (form) ≠ Tournament “Browse tournaments” (list).
 * Paths align with menu groups: /live/*, /me/*, /tournament/*, /data/*.
 */
export const menuItems: MenuItem[] = [
	{
		id: 'live',
		labelKey: 'live',
		icon: Timer,
		items: [
			{ labelKey: 'livePoints', href: '/live/points' },
			{ labelKey: 'liveTournaments', href: '/live/tournaments' },
			{ labelKey: 'liveMatches', href: '/live/matches' },
		],
	},
	{
		id: 'me',
		labelKey: 'me',
		icon: UserRound,
		items: [
			{ labelKey: 'teamStats', href: '/me/team' },
			// Personal review — same “My …” voice as My Team
			{ labelKey: 'tournamentStats', href: '/me/tournament' },
		],
	},
	{
		id: 'tournament',
		labelKey: 'tournament',
		icon: Medal,
		items: [
			// Ops pair: create vs browse (matches homepage “Browse tournaments”)
			{ labelKey: 'createTournaments', href: '/tournament/create' },
			{ labelKey: 'myTournaments', href: '/tournament/browse?mine=true' },
		],
	},
	{
		id: 'data',
		labelKey: 'data',
		icon: BarChart2,
		items: [
			{ labelKey: 'gameweekStats', href: '/data/gameweek' },
			{ labelKey: 'fixtures', href: '/data/fixtures' },
			{ labelKey: 'priceChanges', href: '/data/market' },
			{ labelKey: 'selections', href: '/data/selections' },
			{ labelKey: 'playerStats', href: '/data/player-stats' },
		],
	},
]
