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
		try {
			const body = JSON.parse(raw)
			query = typeof body.query === 'string' ? body.query : ''
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
							risers: [{
								player: marketPlayer,
								previousSelectedByPercent: 31.5,
								selectedByPercent: 32.5,
								change: 1
							}],
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
