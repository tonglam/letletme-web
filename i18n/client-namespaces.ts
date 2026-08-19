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
	fixtures: ['Fixtures', 'Share'],
	gameweek: ['GameweekStats', 'PlayerDirectory', 'Share'],
	market: ['Market', 'Share'],
	playerStats: [
		'PlayerStats',
		'PlayerDirectory',
		'Filters',
		'Market',
		'Common',
		'Share'
	],
	selections: ['Selections', 'Share'],
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
	competitionsDetail: ['LiveTournament', 'TournamentLifecycle', 'Share'],
	liveMatches: ['LiveMatches', 'SeasonState', 'Share'],
	livePoints: ['LivePoints', 'SeasonState', 'Share'],
	liveCompetitions: ['LiveTournament', 'TournamentLifecycle', 'SeasonState', 'Share'],
	myFpl: ['TeamStats', 'TournamentStats', 'TournamentLifecycle', 'Filters', 'Share'],
	onboarding: ['Onboarding'],
	profile: ['Profile', 'Sessions', 'ReportProblem']
} as const satisfies Record<string, readonly (keyof IntlMessages)[]>

export type ClientMessageNamespace = keyof IntlMessages
