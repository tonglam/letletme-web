import { createServer } from 'node:http'

const host = '127.0.0.1'
const port = Number(process.env.E2E_GRAPHQL_PORT ?? 4100)
const liveHydrationFixtureEnabled = process.env.E2E_LIVE_HYDRATION === '1'

const json = (response, status, body) => {
	response.writeHead(status, {
		'Cache-Control': 'no-store',
		'Content-Type': 'application/json'
	})
	response.end(JSON.stringify(body))
}

const shiftIsoDate = (date, days) => {
	const value = new Date(`${date}T00:00:00.000Z`)
	value.setUTCDate(value.getUTCDate() + days)
	return value.toISOString().slice(0, 10)
}

const scheduledMatch = {
	matchId: 101,
	minutes: 0,
	homeTeamId: 1,
	homeTeamName: 'Arsenal',
	homeTeamShortName: 'ARS',
	homeScore: 0,
	homeTeamDataList: [],
	awayTeamId: 2,
	awayTeamName: 'Chelsea',
	awayTeamShortName: 'CHE',
	awayScore: 0,
	awayTeamDataList: [],
	kickoffTime: '2026-08-04T19:00:00.000Z',
	playStatus: 'NOT_STARTED'
}

const hydrationLiveMatch = {
	...scheduledMatch,
	homeScore: 2,
	awayScore: 0,
	minutes: 45,
	playStatus: 'LIVE'
}

const marketPlayer = {
	playerId: 1,
	playerCode: 1001,
	webName: 'Saka',
	teamId: 1,
	teamName: 'Arsenal',
	teamShortName: 'ARS',
	position: 'MIDFIELDER',
	price: 100,
	selectedByPercent: 32.5
}

const pickerTeams = [
	{ id: 1, name: 'Arsenal', shortName: 'ARS' },
	{ id: 2, name: 'Chelsea', shortName: 'CHE' },
	{ id: 3, name: 'Everton', shortName: 'EVE' }
]

const pickerPlayers = [
	{
		id: 1,
		webName: 'Saka',
		position: 'MIDFIELDER',
		price: 100,
		selectedByPercent: 32.5,
		totalPoints: 181,
		form: 6.2,
		team: pickerTeams[0]
	},
	{
		id: 2,
		webName: 'Palmer',
		position: 'MIDFIELDER',
		price: 105,
		selectedByPercent: 41.2,
		totalPoints: 195,
		form: 7.1,
		team: pickerTeams[1]
	}
]

const playerStatsContext = {
	scope: 'CURRENT_SEASON',
	season: '2627',
	asOfEventId: 33,
	status: 'AVAILABLE',
	revision: 'player-stats-e2e-v1',
	sourceCheckedAt: '2026-08-13T09:40:00.000Z',
	publishedAt: '2026-08-13T09:40:05.000Z',
	rowCount: pickerPlayers.length,
	expectedRowCount: pickerPlayers.length
}

const authoritativePlayerDataAvailability = () => ({
	isFullyAuthoritative: true,
	seasonStats: {
		state: 'READY',
		reasonCode: null,
		revision: 'player-season-e2e-v1',
		sourceCheckedAt: '2026-08-13T09:40:00.000Z'
	},
	market: {
		state: 'READY',
		reasonCode: null,
		revision: 'player-market-e2e-v1',
		sourceCheckedAt: '2026-08-13T09:40:00.000Z'
	},
	historicalTeam: {
		state: 'EMPTY',
		reasonCode: null,
		revision: 'player-history-e2e-v1',
		sourceCheckedAt: '2026-08-13T09:40:00.000Z'
	},
	fixtures: {
		state: 'READY',
		reasonCode: null,
		revision: 'player-fixtures-e2e-v1',
		sourceCheckedAt: '2026-08-13T09:40:00.000Z'
	},
	recentGameweeks: {
		state: 'READY',
		reasonCode: null,
		revision: 'player-recent-e2e-v1',
		sourceCheckedAt: '2026-08-13T09:40:00.000Z'
	}
})

const playerDetail = playerId => {
	const player =
		pickerPlayers.find(candidate => candidate.id === playerId) ??
		pickerPlayers[0]
	return {
		id: player.id,
		webName: player.webName,
		teamShortName: player.team.shortName,
		elementType: 3,
		elementTypeName: 'MIDFIELDER',
		price: player.price,
		startPrice: player.price - 5,
		statsContext: {
			...playerStatsContext
		},
		injuryAvailability: {
			status: 'a',
			news: '',
			newsAdded: null,
			observedDate: '2026-08-13',
			capturedAt: '2026-08-13T09:40:00.000Z',
			chanceOfPlayingThisRound: 100,
			chanceOfPlayingNextRound: 100,
			stale: false
		},
		dataAvailability: authoritativePlayerDataAvailability(),
		totalPoints: player.totalPoints,
		selectedByPercent: player.selectedByPercent,
		form: player.form,
		seasonTransfersIn: 100000,
		seasonTransfersOut: 20000,
		transfersInEvent: 12000,
		transfersOutEvent: 3000,
		eventPoints: 8,
		minutes: 900,
		starts: 10,
		goalsScored: player.id === 1 ? 8 : 10,
		assists: 7,
		cleanSheets: 5,
		goalsConceded: 9,
		ownGoals: 0,
		penaltiesSaved: 0,
		yellowCards: 1,
		redCards: 0,
		saves: 0,
		bonus: 16,
		bps: 240,
		expectedGoals: 7.2,
		expectedAssists: 5.8,
		expectedGoalInvolvements: 13,
		expectedGoalsConceded: 0,
		influence: 420,
		creativity: 510,
		threat: 600,
		ictIndex: 153,
		recentGameweeks: [
			{
				eventId: 33,
				provisional: false,
				totalPoints: 8,
				minutes: 90,
				started: true,
				goalsScored: 1,
				assists: 0,
				cleanSheets: 1,
				saves: 0,
				bonus: 2,
				bps: 31,
				opponents: [{ teamShortName: 'EVE', wasHome: true }]
			}
		],
		fixtures: [
			{
				id: 3401 + player.id,
				event: 34,
				againstTeamShortName: player.id === 1 ? 'CHE' : 'ARS',
				wasHome: player.id === 1,
				finished: false,
				kickoffTime: '2026-08-11T19:00:00.000Z',
				score: null,
				difficulty: 3,
				bgw: false
			}
		]
	}
}

const overviewState = (playerId, horizon) => ({
	playerId,
	teamId: playerId,
	position: 3,
	season: '2627',
	horizon,
	asOfEventId: 33,
	asOf: '2026-08-13T09:40:00.000Z',
	trend: 'STABLE',
	confidence: 'HIGH',
	fplOnly: false,
	reasons: [{ code: 'STATE_STABLE' }],
	profileRadar: null,
	dimensions: [
		{
			kind: 'AVAILABILITY_ROLE',
			rating: 'SECURE',
			direction: 'STABLE',
			confidence: 'HIGH',
			reasonCodes: ['ROLE_SECURE']
		},
		{
			kind: 'FPL_OUTPUT',
			rating: 'STRONG',
			direction: 'STABLE',
			confidence: 'HIGH',
			reasonCodes: ['OUTPUT_STRONG']
		},
		{
			kind: 'REAL_WORLD_PROCESS',
			rating: 'TYPICAL',
			direction: 'STABLE',
			confidence: 'HIGH',
			reasonCodes: ['PROCESS_TYPICAL']
		},
		{
			kind: 'HISTORICAL_RELIABILITY',
			rating: 'PROVEN',
			direction: 'STABLE',
			confidence: 'HIGH',
			reasonCodes: ['RELIABILITY_PROVEN']
		},
		{
			kind: 'OUTLOOK',
			rating: 'NEUTRAL',
			direction: 'STABLE',
			confidence: 'HIGH',
			reasonCodes: ['OUTLOOK_NEUTRAL']
		}
	]
})

const contextState = playerId => ({
	playerId,
	ownBaseline: { weightedPercentile: 70, seasons: [] },
	peerBaseline: {
		position: 3,
		minimumMinutes: 900,
		cohortSize: 20,
		currentPercentile: 72
	},
	careerTrajectory: [],
	coverage: { providers: [] }
})

const processState = playerId => ({
	playerId,
	dimensions: [
		{
			kind: 'REAL_WORLD_PROCESS',
			rating: 'TYPICAL',
			direction: 'STABLE',
			confidence: 'HIGH',
			reasonCodes: ['PROCESS_TYPICAL'],
			metrics: [
				{
					code: 'UNDERSTAT_NPXG_PER_90',
					source: 'UNDERSTAT_CURRENT',
					value: 0.31,
					baseline: 0.3,
					percentile: 62,
					unit: 'per90',
					season: '2627',
					sampleMinutes: 900,
					sampleSize: 20,
					smallSample: false,
					capability: true
				}
			]
		}
	],
	coverage: {
		understatCurrent: true,
		mappingStatus: 'VERIFIED',
		metricCoverage: ['UNDERSTAT_NPXG_PER_90'],
		limitations: []
	}
})

const planningFixturesForEvent = eventId => {
	const event = { id: eventId, name: `Gameweek ${eventId}` }
	const arsenal = { id: 1, name: 'Arsenal', shortName: 'ARS' }
	const chelsea = { id: 2, name: 'Chelsea', shortName: 'CHE' }
	const everton = { id: 3, name: 'Everton', shortName: 'EVE' }
	const fixture = (
		id,
		homeTeam,
		awayTeam,
		homeTeamDifficulty,
		awayTeamDifficulty,
		result = {}
	) => ({
		id,
		code: id,
		event,
		kickoffTime: '2026-08-09T15:00:00.000Z',
		finished: result.finished ?? false,
		started: result.started ?? result.finished ?? false,
		homeTeam,
		awayTeam,
		homeScore: result.homeScore ?? null,
		awayScore: result.awayScore ?? null,
		homeTeamDifficulty,
		awayTeamDifficulty
	})
	if (eventId === 1) {
		return [
			fixture(1001, arsenal, chelsea, 2, 4, {
				finished: true,
				started: true,
				homeScore: 2,
				awayScore: 1
			})
		]
	}
	if (eventId === 33) {
		return [
			fixture(3301, arsenal, chelsea, 2, 4),
			fixture(3302, everton, arsenal, 4, 2)
		]
	}
	if (eventId === 34) return [fixture(3401, chelsea, everton, 2, 3)]
	return []
}

const livePicks = Array.from({ length: 15 }, (_, index) => {
	const element = index + 1
	return {
		element,
		elementType: element <= 2 ? 1 : element <= 7 ? 2 : element <= 12 ? 3 : 4,
		position: element,
		webName: `Player ${element}`,
		teamName: 'Arsenal',
		teamShortName: 'ARS',
		minutes: 45,
		goalsScored: element === 1 ? 1 : 0,
		assists: 0,
		cleanSheets: 0,
		goalsConceded: element === 1 ? 2 : 0,
		defensiveContribution: 0,
		ownGoals: 0,
		penaltiesSaved: 0,
		penaltiesMissed: 0,
		yellowCards: 0,
		redCards: 0,
		saves: 0,
		bonus: 0,
		bps: 10,
		totalPoints: element === 1 ? 6 : 1,
		starts: element <= 11,
		isGwStarted: true,
		isGwFinished: false,
		isPlayed: true,
		isCaptain: element === 1,
		isViceCaptain: element === 2,
		multiplier: element === 1 ? 2 : 1,
		pickActive: element <= 11,
		autoSub: false,
		bgw: false,
		expectedGoals: null,
		expectedAssists: null,
		expectedGoalInvolvements: null,
		expectedGoalsConceded: null,
		inDreamTeam: false
	}
})

const squadPicks = livePicks.map(pick => ({
	...pick,
	elementTypeName:
		pick.element <= 2
			? 'GOALKEEPER'
			: pick.element <= 7
				? 'DEFENDER'
				: pick.element <= 12
					? 'MIDFIELDER'
					: 'FORWARD',
	isCaptain: pick.element === 1,
	isViceCaptain: pick.element === 2,
	multiplier: pick.element === 1 ? 2 : 1
}))

const liveRevisionVector = revision => ({
	publicationId: `e2e-live-${revision.slice(0, 8)}`,
	generation: 1,
	lifecycle: revision,
	fixtureIdentity: revision,
	scoreCore: revision,
	displayStats: revision,
	explain: revision,
	picksBase: revision,
	officialAdjustment: null,
	previousTotals: null,
	finalResult: null,
	rules: revision,
	algorithm: 'live-points-v2-algorithm-1',
	input: revision
})

const liveTimes = (
	sourceCheckedAt = '2026-08-04T18:00:30.000Z',
	publishedAt = '2026-08-04T18:00:00.000Z'
) => ({
	sourceCheckedAt,
	contentUpdatedAt: publishedAt,
	publishedAt,
	checkpointedAt: null,
	servedAt: sourceCheckedAt,
	staleAt: sourceCheckedAt,
	nextRefreshAt: '2026-08-04T18:01:00.000Z'
})

const liveDelivery = state => ({
	state,
	servedFrom: 'REDIS_CURRENT',
	reasonCodes: []
})

const liveMatchdaySnapshot = ({ match, state, revision }) => ({
	season: '2627',
	eventId: 33,
	state,
	revisions: {
		deskPublicationId: `e2e-matchday-${revision.slice(0, 8)}`,
		deskGeneration: 1,
		lifecycle: revision,
		fixtureIdentity: revision,
		scoreState: revision,
		detailPublicationId:
			state === 'PRE_DEADLINE'
				? null
				: `e2e-match-detail-${revision.slice(0, 8)}`,
		detailGeneration: state === 'PRE_DEADLINE' ? null : 1,
		playerDetail: state === 'PRE_DEADLINE' ? null : revision
	},
	times: {
		deskSourceCheckedAt: '2026-08-04T18:00:30.000Z',
		deskContentUpdatedAt: '2026-08-04T18:00:00.000Z',
		deskPublishedAt: '2026-08-04T18:00:00.000Z',
		deskStaleAt: '2026-08-04T18:01:07.500Z',
		detailSourceCheckedAt:
			state === 'PRE_DEADLINE' ? null : '2026-08-04T18:00:30.000Z',
		detailContentUpdatedAt:
			state === 'PRE_DEADLINE' ? null : '2026-08-04T18:00:00.000Z',
		detailPublishedAt:
			state === 'PRE_DEADLINE' ? null : '2026-08-04T18:00:00.000Z',
		detailStaleAt: state === 'PRE_DEADLINE' ? null : '2026-08-04T18:01:07.500Z',
		servedAt: '2026-08-04T18:00:30.000Z',
		nextRefreshAt: '2026-08-04T18:01:00.000Z'
	},
	detailDelivery:
		state === 'PRE_DEADLINE'
			? {
					state: 'PENDING',
					servedFrom: null,
					reasonCodes: ['DETAIL_NOT_PUBLISHED']
				}
			: liveDelivery(state === 'FINALIZED' ? 'FINAL' : 'FRESH'),
	matches: [
		{
			fixtureId: match.matchId,
			eventId: 33,
			homeTeamId: match.homeTeamId,
			homeTeamName: match.homeTeamName,
			homeTeamShortName: match.homeTeamShortName,
			awayTeamId: match.awayTeamId,
			awayTeamName: match.awayTeamName,
			awayTeamShortName: match.awayTeamShortName,
			homeScore: match.homeScore,
			awayScore: match.awayScore,
			kickoffTime: match.kickoffTime,
			minutes: match.minutes,
			started: state === 'LIVE_ACTIVE',
			finished: false,
			finishedProvisional: false,
			players: []
		}
	]
})

const liveSnapshot = ({
	eventId = 33,
	revision = 'a'.repeat(64),
	state = 'LIVE_ACTIVE',
	sourceCheckedAt = '2026-08-04T18:00:30.000Z',
	publishedAt = '2026-08-04T18:00:00.000Z'
} = {}) => ({
	season: '2627',
	eventId,
	state,
	revisions: liveRevisionVector(revision),
	times: liveTimes(sourceCheckedAt, publishedAt),
	delivery: liveDelivery(state === 'FINALIZED' ? 'FINAL' : 'FRESH')
})

const liveScore = (eventPoints = 22, revision = 'a'.repeat(64)) => ({
	eventPoints,
	netEventPoints: eventPoints,
	totalPoints: 1234,
	totalScope: 'OVERALL',
	transferCost: 0,
	source: 'FPL_EVENT_LIVE',
	calculationMode: 'PROJECTED_AUTOSUBS',
	revisions: liveRevisionVector(revision),
	times: liveTimes(),
	delivery: liveDelivery('FRESH')
})

let recoveryEntryRequestCount = 0

const server = createServer((request, response) => {
	if (request.method === 'GET' && request.url === '/health') {
		json(response, 200, { ok: true })
		return
	}
	if (request.method !== 'POST' || request.url !== '/graphql') {
		json(response, 404, { errors: [{ message: 'Not found' }] })
		return
	}

	let raw = ''
	request.setEncoding('utf8')
	request.on('data', chunk => {
		raw += chunk
	})
	request.on('end', () => {
		let query = ''
		let variables = {}
		try {
			const body = JSON.parse(raw)
			query = typeof body.query === 'string' ? body.query : ''
			variables =
				body.variables && typeof body.variables === 'object'
					? body.variables
					: {}
		} catch {
			json(response, 400, { errors: [{ message: 'Invalid JSON' }] })
			return
		}

		if (query.includes('GetHomePublicBootstrap')) {
			json(response, 200, {
				data: {
					homePublicBootstrap: {
						context: {
							season: '2627',
							revision: '7',
							sourceCheckedAt: '2026-08-13T09:40:00.000Z',
							currentEventId: 33,
							nextEventId: 34,
							nextDeadlineTime: '2026-08-21T17:30:00.000Z',
							latestFinishedEventId: 32
						},
						fixtures: planningFixturesForEvent(34)
					}
				}
			})
			return
		}
		if (query.includes('GetHomeEventFixtures')) {
			const eventId = Number(variables.eventId)
			json(response, 200, {
				data: {
					coreEventContext: {
						season: '2627',
						revision: '7',
						sourceCheckedAt: '2026-08-13T09:40:00.000Z',
						currentEventId: 33
					},
					eventFixtures: planningFixturesForEvent(eventId)
				}
			})
			return
		}
		if (query.includes('GetHomeGameweek')) {
			const eventId = Number(variables.eventId) || 33
			json(response, 200, {
				data: {
					homeGameweek: {
						transfersState: 'AVAILABLE',
						gameweekDesk: {
							season: '2627',
							coreRevision: '7',
							scoreCoreRevision: '8',
							eventId,
							lifecycle: 'PROVISIONAL',
							overviewState: 'AVAILABLE',
							boardsState: 'AVAILABLE',
							overview: {
								highestPoints: 101,
								highestScoringEntry: 15702,
								mostCaptained: {
									id: 1,
									webName: 'Saka',
									teamShortName: 'ARS'
								},
								topScorer: {
									id: 1,
									webName: 'Saka',
									teamShortName: 'ARS',
									points: 12
								},
								mostPlayedChip: { name: 'wildcard', numberPlayed: 5 }
							},
							dreamTeam: [
								{
									id: 1,
									webName: 'Saka',
									position: 'MIDFIELDER',
									teamShortName: 'ARS',
									totalPoints: 12
								}
							]
						},
						topTransfersIn: [],
						topTransfersOut: []
					}
				}
			})
			return
		}
		if (query.includes('GetHomePersonalDesk')) {
			let entryId = null
			try {
				const encoded = request.headers['x-user-context']
				const envelope = JSON.parse(
					Buffer.from(String(encoded), 'base64url').toString('utf8')
				)
				entryId = Number(envelope.eid)
			} catch {}
			if (entryId === 909090) {
				json(response, 503, {
					errors: [{ message: 'Temporary Home personal desk failure' }]
				})
				return
			}
			json(response, 200, {
				data: {
					homePersonalDesk: {
						state: 'READY',
						entryName: 'E2E United',
						playerName: 'Test Manager',
						region: 'Australia',
						overallPoints: 1234,
						pointsState: 'LIVE',
						pointsCheckedAt: '2026-08-25T00:00:00.000Z',
						overallRank: 56789,
						rankState: 'UPDATING',
						rankCheckedAt: '2026-08-24T00:00:00.000Z',
						teamValue: 1005,
						bank: 15,
						leagueRanks: Array.from({ length: 8 }, (_, index) => ({
							key: `${index === 6 ? 'h2h' : 'classic'}:${314 + index}`,
							name:
								index === 0
									? 'E2E Classic'
									: index === 6
										? 'E2E H2H'
										: `E2E League ${index + 1}`,
							leagueType: index === 6 ? 'H2H' : 'CLASSIC',
							visibility: index >= 3 ? 'PUBLIC' : 'PRIVATE',
							rank: 12 + index,
							rankState: 'UPDATING',
							rankCheckedAt: '2026-08-24T00:00:00.000Z',
							movement:
								index === 0
									? { direction: 'UP', places: 6 }
									: { direction: 'FLAT', places: 0 },
							tournamentId: index === 1 ? 77 : index === 6 ? 6 : null,
							h2hMatchup:
								index === 6
									? {
											officialMatchId: 2071743,
											eventId: 1,
											isLive: true,
											isFinal: false,
											isBye: false,
											sourceCheckedAt: '2026-08-22T20:09:19.668Z',
											viewer: {
												entryId: 15702,
												entryName: '让让群の一美',
												playerName: 'Future Xu',
												isAverage: false,
												points: 24
											},
											opponent: {
												entryId: 31056,
												entryName: 'Tong言无忌',
												playerName: '炸群高手 磊磊酱',
												isAverage: false,
												points: 43
											}
										}
									: null
						})),
						sourceCheckedAt: '2026-08-14T00:00:00.000Z'
					}
				}
			})
			return
		}

		if (query.includes('GetPlayerStatsBootstrap')) {
			json(response, 200, {
				data: {
					playerStatsBootstrap: {
						context: {
							season: '2627',
							revision: '7',
							sourceCheckedAt: '2026-08-13T09:40:00.000Z',
							currentEventId: 33,
							nextEventId: 34,
							nextDeadlineTime: '2026-08-11T17:30:00.000Z',
							latestFinishedEventId: 32
						},
						statsContext: playerStatsContext,
						teams: pickerTeams,
						directory: {
							items: pickerPlayers,
							totalCount: pickerPlayers.length,
							nextCursor: null
						}
					}
				}
			})
			return
		}
		if (query.includes('GetPlayerStatsDesk')) {
			const playerIds = Array.isArray(variables.playerIds)
				? variables.playerIds
						.filter(id => Number.isInteger(id) && id > 0)
						.slice(0, 2)
				: []
			const eventId = Number(variables.eventId) || 33
			const horizon = Number(variables.horizon) || 5
			const entries = playerIds.map(playerId => {
				if (query.includes('GetPlayerStatsDeskOverview')) {
					return {
						playerId,
						overview: playerDetail(playerId),
						state: overviewState(playerId, horizon)
					}
				}
				if (query.includes('GetPlayerStatsDeskContext')) {
					return { playerId, state: contextState(playerId) }
				}
				if (query.includes('GetPlayerStatsDeskProcess')) {
					return {
						playerId,
						evidence: playerDetail(playerId),
						state: processState(playerId)
					}
				}
				return { playerId, evidence: playerDetail(playerId) }
			})
			json(response, 200, {
				data: {
					playerStatsDesk: { eventId, horizon, entries }
				}
			})
			return
		}

		if (
			query.includes('GetCurrentAndNextEvents') ||
			query.includes('GetCoreEventContext')
		) {
			json(response, 200, {
				data: query.includes('GetCoreEventContext')
					? {
							coreEventContext: {
								season: '2627',
								revision: '7',
								sourceCheckedAt: '2026-08-13T09:40:00.000Z',
								currentEventId: 33,
								nextEventId: 34,
								nextDeadlineTime: '2026-08-11T17:30:00.000Z',
								latestFinishedEventId: 32
							}
						}
					: {
							current: [{ id: 33 }],
							next: [{ id: 34, deadlineTime: '2026-08-11T17:30:00.000Z' }]
						}
			})
			return
		}
		if (query.includes('GetGameweekDesk')) {
			const eventId = Number(variables.eventId) || 33
			const scheduled = eventId > 33
			const boardPlayer = (id, webName, totalPoints) => ({
				id,
				webName,
				position: 'MIDFIELDER',
				teamShortName: 'ARS',
				price: 100,
				minutes: 90,
				goalsScored: totalPoints >= 12 ? 2 : 1,
				assists: 0,
				cleanSheets: 1,
				bonus: 3,
				totalPoints
			})
			json(response, 200, {
				data: {
					gameweekDesk: {
						season: '2627',
						coreRevision: '7',
						scoreCoreRevision: scheduled ? null : '8',
						anchorEventId: 33,
						eventId,
						currentEventId: 33,
						nextEventId: 34,
						isPreseason: false,
						lifecycle: scheduled ? 'SCHEDULED' : 'PROVISIONAL',
						deadlineTime: '2026-08-04T17:30:00.000Z',
						publishedAt: scheduled ? null : '2026-08-04T19:00:00.000Z',
						overviewState: scheduled ? 'PENDING' : 'AVAILABLE',
						boardsState: scheduled ? 'PENDING' : 'AVAILABLE',
						overview: scheduled
							? null
							: {
									averagePoints: 52,
									highestPoints: 101,
									mostCaptained: {
										id: 1,
										webName: 'Saka',
										teamShortName: 'ARS'
									},
									mostViceCaptained: {
										id: 2,
										webName: 'Palmer',
										teamShortName: 'CHE'
									},
									mostSelected: {
										id: 1,
										webName: 'Saka',
										teamShortName: 'ARS'
									},
									mostTransferredIn: {
										id: 2,
										webName: 'Palmer',
										teamShortName: 'CHE'
									},
									chipsPlayed: {
										benchBoost: 2,
										tripleCaptain: 1,
										wildcard: 5,
										freeHit: 1
									}
								},
						dreamTeam: scheduled ? [] : [boardPlayer(1, 'Saka', 12)],
						hauls: scheduled
							? []
							: [boardPlayer(1, 'Saka', 12), boardPlayer(2, 'Palmer', 11)]
					}
				}
			})
			return
		}
		if (query.includes('GetEventStatsById')) {
			json(response, 200, {
				data: {
					event: {
						id: Number(variables.eventId) || 33,
						averageEntryScore: 52,
						highestScore: 101,
						mostSelected: null,
						mostTransferredIn: null,
						mostCaptained: null,
						mostViceCaptained: null,
						transfersMade: 12345,
						chipPlays: []
					}
				}
			})
			return
		}
		if (query.includes('GetFixtureWindow')) {
			const data = Object.fromEntries(
				Object.entries(variables)
					.filter(([key]) => /^event\d+$/.test(key))
					.map(([key, eventId]) => [
						key,
						planningFixturesForEvent(Number(eventId))
					])
			)
			json(response, 200, { data })
			return
		}
		if (query.includes('GetEventFixtures')) {
			const eventId = Number(variables.eventId)
			const event = { id: eventId, name: `Gameweek ${eventId}` }
			const team = (id, name, shortName) => ({ id, name, shortName })
			const fixture = (
				id,
				homeTeam,
				awayTeam,
				homeDifficulty,
				awayDifficulty
			) => ({
				id,
				code: id,
				event,
				kickoffTime: '2026-08-09T15:00:00.000Z',
				finished: false,
				started: false,
				homeTeam,
				awayTeam,
				homeScore: null,
				awayScore: null,
				homeTeamDifficulty: homeDifficulty,
				awayTeamDifficulty: awayDifficulty
			})
			const arsenal = team(1, 'Arsenal', 'ARS')
			const chelsea = team(2, 'Chelsea', 'CHE')
			const everton = team(3, 'Everton', 'EVE')
			const eventFixtures =
				eventId === 33
					? [
							fixture(3301, arsenal, chelsea, 2, 4),
							fixture(3302, everton, arsenal, 4, 2)
						]
					: eventId === 34
						? [fixture(3401, chelsea, everton, 2, 3)]
						: []
			json(response, 200, { data: { eventFixtures } })
			return
		}
		if (query.includes('GetTeamsForPicker')) {
			json(response, 200, {
				data: {
					teams: [
						{ id: 1, name: 'Arsenal', shortName: 'ARS' },
						{ id: 2, name: 'Chelsea', shortName: 'CHE' },
						{ id: 3, name: 'Everton', shortName: 'EVE' }
					]
				}
			})
			return
		}
		if (query.includes('SearchPlayersForPicker')) {
			const search =
				typeof variables.search === 'string'
					? variables.search.trim().toLowerCase()
					: ''
			const directory = [
				{
					id: 1,
					webName: 'Saka',
					position: 'MIDFIELDER',
					price: 100,
					selectedByPercent: 32.5,
					totalPoints: 181,
					form: 6.2,
					team: { id: 1, name: 'Arsenal', shortName: 'ARS' }
				},
				{
					id: 2,
					webName: 'Palmer',
					position: 'MIDFIELDER',
					price: 105,
					selectedByPercent: 41.2,
					totalPoints: 195,
					form: 7.1,
					team: { id: 2, name: 'Chelsea', shortName: 'CHE' }
				}
			]
			const items = search
				? directory.filter(player =>
						player.webName.toLowerCase().includes(search)
					)
				: directory
			json(response, 200, {
				data: {
					playersForPicker: {
						items,
						totalCount: items.length,
						nextCursor: null
					}
				}
			})
			return
		}
		if (query.includes('GetPlayerStateProfile')) {
			json(response, 200, { data: { playerStateProfile: null } })
			return
		}
		if (query.includes('GetPlayerEvidence')) {
			json(response, 200, {
				data: {
					playerDetail: {
						id: Number(variables.playerId) || 1,
						webName: 'Saka',
						teamShortName: 'ARS',
						elementType: 3,
						elementTypeName: 'MIDFIELDER',
						statsContext: {
							...playerStatsContext
						},
						fixtures: [],
						recentGameweeks: [],
						totalPoints: 181,
						selectedByPercent: 32.5,
						form: 6.2,
						minutes: 900,
						starts: 10,
						goalsScored: 8,
						assists: 7,
						cleanSheets: 5,
						goalsConceded: 9,
						ownGoals: 0,
						penaltiesSaved: 0,
						yellowCards: 1,
						redCards: 0,
						saves: 0,
						bonus: 16,
						bps: 240,
						expectedGoals: 7.2,
						expectedAssists: 5.8,
						expectedGoalInvolvements: 13,
						expectedGoalsConceded: 0,
						influence: 420,
						creativity: 510,
						threat: 600,
						ictIndex: 153
					}
				}
			})
			return
		}
		if (query.includes('GetPlayerOverall')) {
			json(response, 200, {
				data: {
					playerDetail: {
						id: Number(variables.playerId) || 1,
						webName: 'Saka',
						teamShortName: 'ARS',
						elementType: 3,
						elementTypeName: 'MIDFIELDER',
						price: 100,
						startPrice: 95,
						statsContext: {
							...playerStatsContext
						},
						injuryAvailability: {
							status: 'a',
							news: '',
							newsAdded: null,
							observedDate: '2026-08-13',
							capturedAt: '2026-08-13T09:40:00.000Z',
							chanceOfPlayingThisRound: 100,
							chanceOfPlayingNextRound: 100,
							stale: false
						},
						dataAvailability: authoritativePlayerDataAvailability(),
						totalPoints: 181,
						selectedByPercent: 32.5,
						form: 6.2,
						transfersInEvent: 12000,
						transfersOutEvent: 3000,
						fixtures: []
					}
				}
			})
			return
		}
		if (query.includes('PublicLeagueSelectionStats')) {
			json(response, 200, {
				data: {
					publicLeagueSelectionStats: {
						totalEntries: 1000,
						mostSelectedPlayers: [
							{
								id: 1,
								webName: 'Saka',
								teamShortName: 'ARS',
								position: 'MIDFIELDER',
								selectedByPercent: 72,
								eoByPercent: 84
							}
						],
						captainSelect: [
							{
								id: 1,
								webName: 'Saka',
								teamShortName: 'ARS',
								position: 'MIDFIELDER',
								captainByPercent: 24,
								selectedByPercent: 72,
								eoByPercent: 84
							}
						],
						mostTransferIn: [],
						mostTransferOut: []
					}
				}
			})
			return
		}
		if (query.includes('TrendCohorts')) {
			json(response, 200, {
				data: {
					trendCohorts: {
						season: '2627',
						revision: 'e2e-trends-catalog-v1',
						cohorts: [
							{
								id: 'competition:777',
								kind: 'TRACKED_OFFICIAL_COMPETITION',
								access: 'PUBLIC',
								displayName: 'E2E Public League',
								setupStatus: 'READY',
								exact: true,
								latestEventId: 33,
								revision: 'e2e-trends-publication-v1',
								availability: 'READY',
								capabilities: [
									{ capability: 'OWNERSHIP', state: 'READY' },
									{ capability: 'EFFECTIVE_OWNERSHIP', state: 'READY' },
									{ capability: 'CAPTAINCY', state: 'READY' },
									{ capability: 'VICE_CAPTAINCY', state: 'READY' },
									{ capability: 'TRANSFERS', state: 'READY' }
								]
							}
						]
					}
				}
			})
			return
		}
		if (query.includes('TrendCohortSnapshot')) {
			const eventId = Number(variables.eventId) || 33
			const cohort = {
				id: String(variables.cohortId || 'competition:777'),
				kind: 'TRACKED_OFFICIAL_COMPETITION',
				access: 'PUBLIC',
				displayName: 'E2E Public League',
				setupStatus: 'READY',
				exact: true,
				latestEventId: 33,
				revision: 'e2e-trends-publication-v1',
				availability: 'READY',
				capabilities: [
					{ capability: 'OWNERSHIP', state: 'READY' },
					{ capability: 'EFFECTIVE_OWNERSHIP', state: 'READY' },
					{ capability: 'CAPTAINCY', state: 'READY' },
					{ capability: 'VICE_CAPTAINCY', state: 'READY' },
					{ capability: 'TRANSFERS', state: 'READY' }
				]
			}
			const row = {
				elementId: 1,
				playerName: 'Saka',
				playerPosition: 3,
				teamShortName: 'ARS',
				count: 720,
				percentage: 72
			}
			json(response, 200, {
				data: {
					trendCohortSnapshot: {
						eventId,
						cohort,
						sections: cohort.capabilities.map(({ capability, state }) => ({
							capability,
							state,
							evidenceContext: {
								availabilityState: 'READY',
								coverageState: 'COMPLETE',
								exact: true,
								denominator: 1000,
								sampleSize: 1000,
								methodKey: 'exact_prepared_competition',
								methodVersion: '1',
								limitations: []
							},
							rows: [row]
						}))
					}
				}
			})
			return
		}
		if (query.includes('PublicLeagueTrends')) {
			json(response, 200, {
				data: {
					publicLeagueTrends: [
						{
							tournamentId: 777,
							displayName: 'E2E Public League',
							sortOrder: 1,
							publishedAt: '2026-08-01T00:00:00.000Z',
							updatedAt: '2026-08-04T19:00:00.000Z',
							latestAvailableEventId: 33,
							totalEntries: 1000
						}
					]
				}
			})
			return
		}
		if (query.includes('GetLiveScores')) {
			json(response, 200, { data: { liveScores: [] } })
			return
		}
		if (
			query.includes('GetTopTransfersIn') ||
			query.includes('GetTopTransfersOut')
		) {
			json(response, 200, {
				data: {
					...(query.includes('GetTopTransfersIn')
						? { topTransfersIn: [] }
						: {}),
					...(query.includes('GetTopTransfersOut')
						? { topTransfersOut: [] }
						: {})
				}
			})
			return
		}
		if (query.includes('GetLiveContext')) {
			json(response, 200, {
				data: {
					coreEventContext: {
						season: '2627',
						revision: 'e2e-core-v1',
						sourceCheckedAt: '2026-08-04T18:00:30.000Z',
						currentEventId: 33,
						nextEventId: 34,
						nextDeadlineTime: '2026-08-11T17:30:00.000Z',
						latestFinishedEventId: 32
					},
					liveContext: {
						season: '2627',
						coreRevision: 'e2e-core-v1',
						eventId: 33,
						nextEventId: 34,
						anchorEventId: 33,
						latestFinalizedEventId: 32,
						scoreCoreRevision: 'a'.repeat(64),
						state: liveHydrationFixtureEnabled ? 'LIVE_ACTIVE' : 'PICKS_PROBE',
						windowState: liveHydrationFixtureEnabled
							? 'LIVE_ACTIVE'
							: 'PRE_DEADLINE',
						producerState: liveHydrationFixtureEnabled
							? 'LIVE_ACTIVE'
							: 'PICKS_PROBE',
						anchorMode: 'CURRENT',
						dataAvailability: liveHydrationFixtureEnabled
							? 'FRESH'
							: 'UNAVAILABLE',
						nextRefreshAt: '2026-08-04T18:01:00.000Z',
						sourceCheckedAt: '2026-08-04T18:00:30.000Z',
						publishedAt: '2026-08-04T18:00:00.000Z',
						source: 'REDIS_CURRENT',
						revisions: liveRevisionVector('a'.repeat(64)),
						times: liveTimes(),
						delivery: liveDelivery(
							liveHydrationFixtureEnabled ? 'FRESH' : 'UNAVAILABLE'
						),
						stale: false
					}
				}
			})
			return
		}
		if (query.includes('GetLiveMatchday')) {
			const match = liveHydrationFixtureEnabled
				? hydrationLiveMatch
				: scheduledMatch
			const state = liveHydrationFixtureEnabled ? 'LIVE_ACTIVE' : 'PRE_DEADLINE'
			json(response, 200, {
				data: {
					liveMatchday: {
						availability: 'READY',
						delivery: liveDelivery('FRESH'),
						snapshot: liveMatchdaySnapshot({
							match,
							state,
							revision: 'a'.repeat(64)
						})
					}
				}
			})
			return
		}
		if (query.includes('GetLiveCalcPoints')) {
			const requestedEntry = Number(variables.entryId) || 123
			if (requestedEntry === 999 && recoveryEntryRequestCount < 2) {
				recoveryEntryRequestCount += 1
				json(response, 200, {
					errors: [{ message: 'Temporary live points failure' }]
				})
				return
			}
			json(response, 200, {
				data: {
					liveSnapshot: liveSnapshot(),
					calcLivePointsByEntry: {
						availability: 'READY',
						delivery: liveDelivery('FRESH'),
						snapshot: liveSnapshot(),
						entry: requestedEntry,
						event: 33,
						entryName: 'E2E United',
						playerName: 'Test Manager',
						chip: null,
						score: liveScore(),
						rank: null,
						provisional: true,
						region: null,
						startedEvent: 1,
						value: 100,
						bank: 0,
						teamValue: 100,
						totalTransfers: 0,
						lastValue: 100,
						playedCaptain: 1,
						activeCaptain: { id: 1, name: 'Player 1', points: 6 },
						captainName: 'Player 1',
						played: 11,
						toPlay: 0,
						pickList: livePicks
					}
				}
			})
			return
		}
		if (query.includes('GetEntryHistory')) {
			json(response, 200, {
				data: {
					entryHistory: {
						results: [{ eventId: 33 }],
						history: []
					}
				}
			})
			return
		}
		if (query.includes('GetEntryEventResult')) {
			const entryId = Number(variables.entryId)
			const eventId = Number(variables.eventId) || 33
			json(response, 200, {
				data: {
					entryEventResult: {
						eventId,
						eventPoints: 22,
						overallPoints: 1234,
						overallRank: 56789,
						eventTransfers: 0,
						eventTransfersCost: 0,
						eventNetPoints: 22,
						eventBenchPoints: 0,
						eventChip: null,
						eventCaptainPoints: 12,
						eventPlayedCaptain: { webName: 'Player 1' },
						eventPicks: squadPicks,
						teamValue: 1005,
						bank: 10,
						entry: {
							id: entryId,
							entryName: 'E2E United',
							playerName: 'Test Manager',
							totalTransfers: 22,
							region: 'Australia'
						}
					}
				}
			})
			return
		}
		if (query.includes('GetEntryLeagues')) {
			const entryId = Number(variables.entryId)
			if (entryId === 909090) {
				json(response, 503, {
					errors: [{ message: 'Temporary personal league failure' }]
				})
				return
			}
			json(response, 200, {
				data: {
					entryLeagues: [
						{
							id: 314,
							name: 'E2E Classic',
							type: 'CLASSIC',
							entryRank: 12,
							entryLastRank: 18,
							totalTeamNum: 100,
							startedEvent: 1,
							tournamentId: null,
							tournamentName: null,
							state: 'ACTIVE'
						}
					]
				}
			})
			return
		}
		if (query.includes('GetEntry')) {
			const entryId = Number(variables.id)
			if (entryId === 909090) {
				json(response, 503, {
					errors: [{ message: 'Temporary personal entry failure' }]
				})
				return
			}
			json(response, 200, {
				data: {
					entryLookup: {
						status: 'FOUND',
						retryable: false,
						source: 'DATABASE',
						persistenceState: 'NOT_REQUIRED',
						entry: {
							id: entryId,
							entryName: 'E2E United',
							playerName: 'Test Manager',
							overallPoints: 1234,
							overallRank: 56789,
							teamValue: 1005,
							bank: 10,
							totalTransfers: 22,
							region: 'Australia'
						}
					}
				}
			})
			return
		}
		if (query.includes('EventLiveExplainBatch')) {
			const elementIds = Array.isArray(variables.elementIds)
				? variables.elementIds
						.filter(id => Number.isInteger(id) && id > 0)
						.slice(0, 15)
				: []
			json(response, 200, {
				data: {
					eventLiveExplains: elementIds.map(elementId => {
						const pick = livePicks.find(
							candidate => candidate.element === elementId
						)
						return {
							elementId,
							stats: {
								minutes: pick?.minutes ?? 0,
								goalsScored: pick?.goalsScored ?? 0,
								assists: pick?.assists ?? 0,
								cleanSheets: pick?.cleanSheets ?? 0,
								goalsConceded: pick?.goalsConceded ?? 0,
								ownGoals: pick?.ownGoals ?? 0,
								penaltiesSaved: pick?.penaltiesSaved ?? 0,
								penaltiesMissed: pick?.penaltiesMissed ?? 0,
								yellowCards: pick?.yellowCards ?? 0,
								redCards: pick?.redCards ?? 0,
								saves: pick?.saves ?? 0,
								defensiveContribution: pick?.defensiveContribution ?? 0,
								bonus: pick?.bonus ?? 0
							},
							contributions: [
								{ identifier: 'minutes', value: 45, points: 1 },
								...(elementId === 1
									? [{ identifier: 'goals_scored', value: 1, points: 6 }]
									: []),
								...(elementId === 1
									? [
											{
												identifier: 'goals_conceded',
												value: 2,
												points: -1
											}
										]
									: [])
							]
						}
					})
				}
			})
			return
		}
		if (query.includes('GetPriceChangeBoard')) {
			json(response, 200, {
				data: {
					priceChangeBoard: {
						status: 'READY',
						source: 'FPL_BOOTSTRAP',
						deadline: '2026-08-04T10:00:00.000Z',
						nextDeadlines: [],
						fetchedAt: '2026-08-03T09:40:00.000Z',
						staleAt: '2026-08-04T09:40:00.000Z',
						revision: 'price-changes-7',
						expectedPlayerCount: 2,
						observedPlayerCount: 2,
						players: [
							{
								playerId: 1,
								playerCode: 1001,
								webName: 'Saka',
								teamId: 1,
								teamName: 'Arsenal',
								teamShortName: 'ARS',
								position: 'MID',
								currentPrice: 100,
								selectedByPercent: 32.5,
								progressPercent: 64.3,
								hourlyRate: 1.2,
								status: 'LIKELY_RISE',
								ownershipTrend: 'UP',
								transfersInEvent: 12000,
								transfersOutEvent: 3000,
								lockedUntil: null,
								calibrating: false
							},
							{
								playerId: 2,
								playerCode: 1002,
								webName: 'Palmer',
								teamId: 2,
								teamName: 'Chelsea',
								teamShortName: 'CHE',
								position: 'MID',
								currentPrice: 105,
								selectedByPercent: 41.2,
								progressPercent: -58.7,
								hourlyRate: -1.1,
								status: 'LIKELY_FALL',
								ownershipTrend: 'DOWN',
								transfersInEvent: 3000,
								transfersOutEvent: 12000,
								lockedUntil: null,
								calibrating: false
							}
						]
					}
				}
			})
			return
		}
		if (
			query.includes('GetMarketPulse') ||
			query.includes('GetHomeMarketPulse') ||
			query.includes('GetHomeMarketOwnership') ||
			query.includes('GetHomeMarketDesk') ||
			query.includes('GetFixturePlanningSignals') ||
			query.includes('GetFixturePlanningOwnershipGameweek') ||
			query.includes('GetMarketOwnershipOverview') ||
			query.includes('GetMarketOwnershipDay')
		) {
			const coverage = {
				status: 'READY',
				requestedDays: 2,
				observedDays: 2,
				firstDate: '2026-08-02',
				latestDate: '2026-08-03',
				fromDate: '2026-08-02',
				toDate: '2026-08-03',
				missingDates: [],
				capturedAt: '2026-08-03T09:40:00.000Z',
				complete: true,
				stale: false
			}
			const selectedDate =
				typeof variables.date === 'string' ? variables.date : '2026-08-03'
			const previousDate = shiftIsoDate(selectedDate, -1)
			const dayCoverage = {
				status: 'READY',
				requestedDays: 2,
				observedDays: 2,
				firstDate: previousDate,
				latestDate: selectedDate,
				fromDate: previousDate,
				toDate: selectedDate,
				missingDates: [],
				capturedAt: `${selectedDate}T09:40:00.000Z`,
				complete: true,
				stale: false
			}
			const ownershipChange = {
				player: marketPlayer,
				fromSelectedByPercent: 31.5,
				toSelectedByPercent: 32.5,
				changePercentagePoints: 1,
				fromDate: previousDate,
				toDate: selectedDate
			}
			const marketOwnershipDay = {
				period: 'DAILY',
				date: selectedDate,
				coverage: dayCoverage,
				risers: [ownershipChange],
				fallers: []
			}
			const marketOwnershipGameweek = {
				period: 'GAMEWEEK',
				gameweek: {
					id: 2,
					name: 'GW2',
					deadlineTime: '2026-08-08T10:00:00.000Z'
				},
				coverage,
				risers: [ownershipChange],
				fallers: []
			}
			const marketOwnershipDailyOverview = {
				period: 'DAILY',
				gameweek: null,
				coverage,
				risers: [ownershipChange],
				fallers: []
			}
			const pulse = {
				coverage: {
					requestedDays: 7,
					observedDays: 2,
					firstDate: '2026-08-02',
					latestDate: '2026-08-03',
					missingDates: [],
					capturedAt: '2026-08-03T09:40:00.000Z',
					complete: false,
					stale: false
				},
				mostSelected: [],
				transferMovers: [],
				availabilityUpdateCount: 0,
				availabilityUpdates: [],
				availabilityHighlights: [],
				newPlayers: [],
				priceChanges: []
			}
			const homeMarketDesk = {
				revision: 'market-7',
				capturedAt: '2026-08-03T09:40:00.000Z',
				ownershipState: 'AVAILABLE',
				ownership: marketOwnershipDay,
				priceChangesState: 'EMPTY',
				priceChanges: [],
				availabilityState: 'EMPTY',
				availabilityUpdates: []
			}
			const data = query.includes('GetHomeMarketDesk')
				? { homeMarketDesk }
				: query.includes('GetMarketOwnershipDay') ||
					  query.includes('GetHomeMarketOwnership')
					? { marketOwnershipDay }
					: query.includes('GetMarketOwnershipOverview')
						? {
								marketOwnershipOverview:
									variables.period === 'GAMEWEEK'
										? marketOwnershipGameweek
										: marketOwnershipDailyOverview
							}
						: query.includes('GetHomeMarketPulse')
							? { homeMarketPulse: pulse }
							: query.includes('GetFixturePlanningOwnershipGameweek')
								? { marketOwnershipOverview: marketOwnershipGameweek }
								: { marketPulse: pulse }
			json(response, 200, {
				data: {
					marketSnapshotContext: {
						season: '2627',
						revision: 'market-7',
						source: 'DATA_PUBLICATION',
						snapshotDate: '2026-08-03',
						capturedAt: '2026-08-03T09:40:00.000Z',
						rowCount: 2
					},
					...data
				}
			})
			return
		}
		if (query.includes('MarketPlayers')) {
			const search =
				typeof variables.search === 'string'
					? variables.search.trim().toLowerCase()
					: ''
			const items = pickerPlayers.filter(
				player => !search || player.webName.toLowerCase().includes(search)
			)
			json(response, 200, {
				data: {
					marketSnapshotContext: {
						season: '2627',
						revision: 'market-7',
						source: 'DATA_PUBLICATION',
						snapshotDate: '2026-08-03',
						capturedAt: '2026-08-03T09:40:00.000Z',
						rowCount: 2
					},
					playersForPicker: {
						items,
						totalCount: items.length,
						nextCursor: null
					}
				}
			})
			return
		}
		if (query.includes('MarketPriceHistory')) {
			json(response, 200, {
				data: {
					marketSnapshotContext: {
						season: '2627',
						revision: 'market-7',
						source: 'DATA_PUBLICATION',
						snapshotDate: '2026-08-03',
						capturedAt: '2026-08-03T09:40:00.000Z',
						rowCount: 2
					},
					playerValueHistory: [
						{
							playerId: Number(variables.playerId) || 1,
							changeDate: '2026-08-03',
							oldValue: 99,
							newValue: 100,
							changeType: 'RISE',
							transfersIn: null,
							transfersOut: null
						}
					]
				}
			})
			return
		}
		if (query.includes('MarketAvailability')) {
			json(response, 200, {
				data: {
					marketAvailabilityPage: {
						context: {
							season: '2627',
							revision: 'market-7',
							source: 'DATA_PUBLICATION',
							snapshotDate: '2026-08-03',
							capturedAt: '2026-08-03T09:40:00.000Z',
							rowCount: 2
						},
						items: [],
						totalCount: 0,
						nextOffset: null
					}
				}
			})
			return
		}
		if (query.includes('GetEventOverallResult')) {
			json(response, 200, {
				data: {
					eventOverallResult: []
				}
			})
			return
		}

		json(response, 503, {
			errors: [{ message: 'No deterministic fixture for this E2E query' }]
		})
	})
})

server.listen(port, host)

const close = () => server.close(() => process.exit(0))
process.on('SIGINT', close)
process.on('SIGTERM', close)
