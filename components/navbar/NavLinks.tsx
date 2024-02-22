export interface LinkProps {
	id: number
	label: string
	title: string
	href: string
	description: string
	icon?: string
}

const liveLinks: LinkProps[] = [
	{
		id: 1,
		label: 'Live',
		title: 'Team',
		href: '/live/entry/1',
		description: "View the team's real-time score",
		icon: 'TbScoreboard'
	},
	{
		id: 2,
		label: 'Live',
		title: 'Tournament',
		href: '/live/tournament/1',
		description: "View the tournament's real-time score and ranking"
	},
	{
		id: 3,
		label: 'Live',
		title: 'Match',
		href: '/live/match',
		description: 'View the real-time score of the Premier League match'
	}
]

const summaryLinks: LinkProps[] = [
	{
		id: 1,
		label: 'Summary',
		title: 'Gameweek',
		href: '/summary/overall',
		description: 'View overall matchweek data'
	},
	{
		id: 2,
		label: 'Summary',
		title: 'Team',
		href: '/summary/entry/1',
		description: 'View team statistics.'
	},
	{
		id: 3,
		label: 'Summary',
		title: 'Tournament',
		href: '/summary/tournament/1',
		description: 'View league statistics'
	}
]

const statLinks: LinkProps[] = [
	{
		id: 1,
		label: 'Stat',
		title: 'Price Change',
		href: '/stat/price',
		description: 'View the daily price changes'
	},
	{
		id: 2,
		label: 'Stat',
		title: 'Selection',
		href: '/stat/select',
		description: 'View the event lineup selection results of the tournament'
	},
	{
		id: 3,
		label: 'Stat',
		title: 'Player',
		href: '/stat/player/1',
		description: 'View player data'
	}
]

export const NavLinks = {
	liveLinks,
	summaryLinks,
	statLinks
}
