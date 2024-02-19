const liveLinks: {
	label: string
	title: string
	href: string
	description: string
}[] = [
	{
		label: 'Live',
		title: 'Team',
		href: '/live/entry/[entry]',
		description: "View the team's real-time score"
	},
	{
		label: 'Live',
		title: 'Tournament',
		href: '/live/tournament/[tournamentId]',
		description: "View the tournament's real-time score and ranking"
	},
	{
		label: 'Live',
		title: 'Match',
		href: '/live/match',
		description: 'View the real-time score of the Premier League match'
	}
]

const summaryLinks: {
	label: string
	title: string
	href: string
	description: string
}[] = [
	{
		label: 'Summary',
		title: 'Gameweek',
		href: '/summary/overall',
		description: 'View overall matchweek data'
	},
	{
		label: 'Summary',
		title: 'Team',
		href: '/summary/entry/[entry]',
		description: 'View team statistics.'
	},
	{
		label: 'Summary',
		title: 'Tournament',
		href: '/summary/tournament/[tournamentId]',
		description: 'View league statistics'
	}
]

const statLinks: {
	label: string
	title: string
	href: string
	description: string
}[] = [
	{
		label: 'Stat',
		title: 'Price Change',
		href: '/stat/price',
		description: 'View the daily price changes'
	},
	{
		label: 'Stat',
		title: 'Selection Result',
		href: '/stat/select',
		description: 'View the event lineup selection results of the tournament'
	},
	{
		label: 'Stat',
		title: 'Player Data',
		href: '/stat/player/[element]',
		description: 'View player data'
	}
]

export const NavLinks = {
	liveLinks,
	summaryLinks,
	statLinks
}
