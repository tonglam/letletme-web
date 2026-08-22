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
	priceChanges: ['PriceChanges', 'Share'],
	playerStats: [
		'PlayerStats',
		'PlayerDirectory',
		'Filters',
		'Market',
		'Common',
		'Share'
	],
	selections: ['Selections', 'Share'],
	competitionsBrowse: ['TournamentList', 'TournamentLifecycle'],
	competitionsCreate: ['TournamentCreate', 'TournamentHelp'],
	competitionsManage: ['TournamentManage', 'TournamentLifecycle'],
	competitionsDetail: ['LiveTournament', 'TournamentLifecycle', 'Share'],
	liveMatches: ['LiveMatches', 'LivePoints', 'SeasonState', 'Share'],
	livePoints: ['LivePoints', 'SeasonState', 'Share'],
	liveCompetitions: [
		'LiveTournament',
		'LivePoints',
		'TournamentLifecycle',
		'SeasonState',
		'Filters',
		'PlayerDirectory',
		'Share'
	],
	myFpl: [
		'TeamStats',
		'TournamentStats',
		'TournamentLifecycle',
		'LivePoints',
		'Filters',
		'Share'
	],
	onboarding: ['Onboarding', 'FplEntryLookup'],
	profile: ['Profile', 'Sessions', 'ReportProblem', 'FplEntryLookup']
} as const satisfies Record<string, readonly (keyof IntlMessages)[]>

export type ClientMessageNamespace = keyof IntlMessages
