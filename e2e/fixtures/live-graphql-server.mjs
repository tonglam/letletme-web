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

		if (query.includes('GetCurrentAndNextEvents')) {
			json(response, 200, {
				data: {
					current: [{ id: 33 }],
					next: [{ id: 34, deadlineTime: '2026-08-11T17:30:00.000Z' }]
				}
			})
			return
		}
		if (query.includes('GetLiveSnapshot')) {
			json(response, 200, {
				data: {
					liveSnapshot: {
						eventId: 33,
						revision: 'a'.repeat(24),
						state: 'SCHEDULED',
						publishedAt: '2026-08-04T18:00:00.000Z',
						checkedAt: '2026-08-04T18:00:30.000Z'
					}
				}
			})
			return
		}
		if (query.includes('GetLiveMatches')) {
			json(response, 200, {
				data: {
					liveSnapshot: {
						eventId: 33,
						revision: 'a'.repeat(24),
						state: 'SCHEDULED',
						publishedAt: '2026-08-04T18:00:00.000Z',
						checkedAt: '2026-08-04T18:00:30.000Z'
					},
					liveMatches: {
						nextEvent: [],
						notStarted: [scheduledMatch],
						playing: [],
						finished: []
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
		if (query.includes('EventLiveExplainBatch')) {
			const elementIds = Array.isArray(variables.elementIds)
				? variables.elementIds
						.filter(id => Number.isInteger(id) && id > 0)
						.slice(0, 15)
				: []
			json(response, 200, {
				data: {
					eventLiveExplains: elementIds.map(elementId => {
						const pick = livePicks.find(candidate => candidate.element === elementId)
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
		if (query.includes('GetMarketPulse')) {
			json(response, 200, {
				data: {
					marketPulse: {
						coverage: {
							requestedDays: 14,
							observedDays: 2,
							firstDate: '2026-08-02',
							latestDate: '2026-08-03',
							capturedAt: '2026-08-03T09:40:00.000Z',
							complete: false,
							stale: false
						},
						mostSelected: [],
						ownershipMovers: {
							risers: [
								{
									player: marketPlayer,
									previousSelectedByPercent: 31.5,
									selectedByPercent: 32.5,
									change: 1
								}
							],
							fallers: []
						},
						transferMovers: [],
						availabilityUpdates: [],
						newPlayers: [],
						priceChanges: []
					}
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
