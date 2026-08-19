export const GLOBAL_CLIENT_NAMESPACES = [
	'Common',
	'Navigation',
	'Language',
	'Theme',
	'ReportProblem'
] as const satisfies readonly (keyof IntlMessages)[]

export const ROUTE_CLIENT_NAMESPACES = {
	home: ['Home'],
	auth: ['Auth'],
	fixtures: ['Fixtures'],
	gameweek: ['GameweekStats', 'PlayerDirectory'],
	market: ['Market'],
	playerStats: [
		'PlayerStats',
		'PlayerDirectory',
		'Filters',
		'Market',
		'Common'
	],
	selections: ['Selections'],
	competitions: [
		'TournamentList',
		'TournamentCreate',
		'TournamentManage',
		'TournamentHelp',
		'TournamentLifecycle',
		'LiveTournament',
		'Filters'
	],
	competitionsBrowse: ['TournamentList', 'TournamentLifecycle'],
	competitionsCreate: ['TournamentCreate', 'TournamentHelp'],
	competitionsManage: ['TournamentManage', 'TournamentLifecycle'],
	competitionsDetail: ['LiveTournament', 'TournamentLifecycle'],
	liveMatches: ['LiveMatches', 'SeasonState'],
	livePoints: ['LivePoints', 'SeasonState'],
	liveCompetitions: ['LiveTournament', 'TournamentLifecycle', 'SeasonState'],
	myFpl: ['TeamStats', 'TournamentStats', 'TournamentLifecycle', 'Filters'],
	onboarding: ['Onboarding'],
	profile: ['Profile', 'Sessions', 'ReportProblem']
} as const satisfies Record<string, readonly (keyof IntlMessages)[]>

export type ClientMessageNamespace = keyof IntlMessages
