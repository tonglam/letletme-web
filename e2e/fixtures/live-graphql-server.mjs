import { createServer } from 'node:http'

const host = '127.0.0.1'
const port = 4100

const json = (response, status, body) => {
	response.writeHead(status, {
		'Cache-Control': 'no-store',
		'Content-Type': 'application/json'
	})
	response.end(JSON.stringify(body))
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
			scope: 'CURRENT_SEASON',
			season: '2627',
			asOfEventId: 33
		},
		availability: {
			status: 'a',
			news: '',
			newsAdded: null,
			observedDate: '2026-08-13',
			capturedAt: '2026-08-13T09:40:00.000Z',
			chanceOfPlayingThisRound: 100,
			chanceOfPlayingNextRound: 100,
			stale: false
		},
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
		awayTeamDifficulty
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
		homeTeamDifficulty,
		awayTeamDifficulty
	})
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
		expectedGoals: null,
		expectedAssists: null,
		expectedGoalInvolvements: null,
		expectedGoalsConceded: null,
		inDreamTeam: false
	}
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
					coreEventContext: { season: '2627', revision: '7' },
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
							liveRevision: '8',
							eventId,
							lifecycle: 'PROVISIONAL',
							overviewState: 'AVAILABLE',
							boardsState: 'AVAILABLE',
							overview: {
								highestPoints: 101,
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
						overallPoints: 1234,
						overallRank: 56789,
						teamValue: 1005,
						leagueRanks: Array.from({ length: 8 }, (_, index) => ({
							key: `classic:${314 + index}`,
							name: index === 0 ? 'E2E Classic' : `E2E League ${index + 1}`,
							rank: 12 + index,
							movement:
								index === 0
									? { direction: 'UP', places: 6 }
									: { direction: 'FLAT', places: 0 },
							tournamentId: index === 1 ? 77 : null
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
						liveRevision: scheduled ? null : '8',
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
							scope: 'CURRENT_SEASON',
							season: '2026-27',
							asOfEventId: 33
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
							scope: 'CURRENT_SEASON',
							season: '2026-27',
							asOfEventId: 33
						},
						availability: {
							status: 'AVAILABLE',
							news: '',
							newsAdded: null,
							observedDate: '2026-08-13',
							capturedAt: '2026-08-13T09:40:00.000Z',
							chanceOfPlayingThisRound: 100,
							chanceOfPlayingNextRound: 100,
							stale: false
						},
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
						revision: 'a'.repeat(24),
						state: 'SCHEDULED',
						checkedAt: '2026-08-04T18:00:30.000Z',
						publishedAt: '2026-08-04T18:00:00.000Z'
					}
				}
			})
			return
		}
		if (query.includes('GetLiveMatchdayDesk')) {
			json(response, 200, {
				data: {
					liveMatchdayDesk: {
						season: '2627',
						eventId: 33,
						revision: 'a'.repeat(24),
						state: 'SCHEDULED',
						publishedAt: '2026-08-04T18:00:00.000Z',
						matches: [],
						nextFixtures: [
							{
								fixtureId: scheduledMatch.matchId,
								eventId: 33,
								homeTeamId: scheduledMatch.homeTeamId,
								homeTeamName: scheduledMatch.homeTeamName,
								awayTeamId: scheduledMatch.awayTeamId,
								awayTeamName: scheduledMatch.awayTeamName,
								homeScore: scheduledMatch.homeScore,
								awayScore: scheduledMatch.awayScore,
								kickoffTime: scheduledMatch.kickoffTime,
								started: false,
								finished: false
							}
						],
						highlights: []
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
					liveSnapshot: {
						eventId: 33,
						revision: 'a'.repeat(24),
						state: 'LIVE',
						publishedAt: '2026-08-04T18:00:00.000Z',
						checkedAt: '2026-08-04T18:00:30.000Z'
					},
					calcLivePointsByEntry: {
						entry: requestedEntry,
						event: 33,
						entryName: 'E2E United',
						playerName: 'Test Manager',
						chip: null,
						livePoints: 22,
						transferCost: 0,
						liveNetPoints: 22,
						liveTotalPoints: 1234,
						captainName: 'Player 1',
						pickList: livePicks
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
		if (
			query.includes('GetMarketPulse') ||
			query.includes('GetHomeMarketPulse') ||
			query.includes('GetFixturePlanningSignals') ||
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
			const ownershipChange = {
				player: marketPlayer,
				fromSelectedByPercent: 31.5,
				toSelectedByPercent: 32.5,
				changePercentagePoints: 1,
				fromDate: '2026-08-02',
				toDate: '2026-08-03'
			}
			const marketOwnershipDay = {
				period: 'DAILY',
				date: '2026-08-03',
				coverage,
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
			const marketOwnershipRolling7d = {
				period: 'ROLLING_7D',
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
			const data = query.includes('GetMarketOwnershipDay')
				? { marketOwnershipDay }
				: query.includes('GetMarketOwnershipOverview')
					? {
							marketOwnershipOverview:
								variables.period === 'GAMEWEEK'
									? marketOwnershipGameweek
									: variables.period === 'DAILY'
										? marketOwnershipDailyOverview
										: marketOwnershipRolling7d
						}
					: query.includes('GetHomeMarketPulse')
						? { homeMarketPulse: pulse, marketOwnershipDay }
						: query.includes('GetFixturePlanningSignals')
							? {
									marketPulse: pulse,
									marketOwnershipGameweek,
									marketOwnershipRolling7d
								}
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
					marketSnapshotContext: {
						season: '2627',
						revision: 'market-7',
						source: 'DATA_PUBLICATION',
						snapshotDate: '2026-08-03',
						capturedAt: '2026-08-03T09:40:00.000Z',
						rowCount: 2
					},
					marketPulse: { availabilityUpdates: [] }
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
