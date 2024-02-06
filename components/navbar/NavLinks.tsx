const liveLinks: { title: string; href: string; description: string }[] = [
	{
		title: '球队',
		href: '/live/entry/[entry]',
		description: '查看球队实时得分'
	},
	{
		title: '联赛',
		href: '/live/tournament/[tournamentId]',
		description: '查看联赛实时得分和排名'
	},
	{
		title: '比赛',
		href: '/live/match',
		description: '查看实时更新的比赛结果'
	}
]

const summaryLinks: { title: string; href: string; description: string }[] = [
	{
		title: '比赛周',
		href: '/summary/overall',
		description: '查看比赛周总体数据'
	},
	{
		title: '球队',
		href: '/summary/entry/[entry]',
		description: '查看球队统计数据'
	},
	{
		title: '联赛',
		href: '/summary/tournament/[tournamentId]',
		description: '查看联赛统计数据'
	},
	{
		title: '团战',
		href: '/summary/groupTournament',
		description: '查看团战数据'
	}
]

const statLinks: { title: string; href: string; description: string }[] = [
	{
		title: '身价变化',
		href: '/stat/price',
		description: '查看每日价格涨跌'
	},
	{
		title: '阵容选择',
		href: '/stat/select',
		description: '查看联赛每轮阵容选择结果'
	},
	{
		title: '球员数据',
		href: '/stat/player/[element]',
		description: '查看球员数据'
	},
	{
		title: '球队数据',
		href: '/stat/team/[teamId]',
		description: '查看球队数据'
	}
]

const NavLinks = {
	liveLinks,
	summaryLinks,
	statLinks
}

export default NavLinks
