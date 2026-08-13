export const GLOBAL_CLIENT_NAMESPACES = [
	'Common',
	'Navigation',
	'Language',
	'Theme'
] as const satisfies readonly (keyof IntlMessages)[]

export const ROUTE_CLIENT_NAMESPACES = {
	home: ['Home'],
	auth: ['Auth'],
	fixtures: ['Fixtures'],
	gameweek: ['GameweekStats'],
	market: ['Market', 'PlayerDirectory', 'Filters', 'PriceChangeList'],
	playerStats: [
		'PlayerStats',
		'PlayerDirectory',
		'Filters',
		'Market',
		'Common'
	],
	selections: ['Selections', 'TournamentLifecycle', 'Filters'],
	competitions: [
		'TournamentList',
		'TournamentCreate',
		'TournamentManage',
		'TournamentHelp',
		'TournamentLifecycle',
		'LiveTournament',
		'Filters'
	],
	live: ['LiveMatches', 'LivePoints', 'LiveTournament', 'TournamentLifecycle'],
	myFpl: ['TeamStats', 'TournamentStats', 'TournamentLifecycle', 'Filters'],
	onboarding: ['Onboarding'],
	profile: ['Profile', 'Sessions']
} as const satisfies Record<string, readonly (keyof IntlMessages)[]>

export type ClientMessageNamespace = keyof IntlMessages
