import type { CoreEventContextData } from '@/lib/graphql/operations/events'

export const GET_LIVE_SCORES = `
  query GetLiveScores($eventId: Int!) {
    liveScores(eventId: $eventId, filter: { inDreamTeam: true }) {
      player {
        id
        webName
        position
        price
        team {
          name
          shortName
        }
      }
      inDreamTeam
      minutes
      goalsScored
      assists
      cleanSheets
      bonus
      totalPoints
    }
  }
`

// Type for live score player
export interface LiveScorePlayer {
	id: number
	webName: string
	position?: string // Should be "GKP", "DEF", "MID", or "FWD"
	price?: number
	team?: {
		name?: string
		shortName?: string
	}
}

// Type for live score entry
export interface LiveScore {
	player: LiveScorePlayer
	inDreamTeam: boolean
	minutes?: number | null
	goalsScored?: number | null
	assists?: number | null
	cleanSheets?: number | null
	bonus?: number | null
	totalPoints: number
}

// Type for live scores response
export interface LiveScoresResponse {
	liveScores: LiveScore[]
}

export const GET_GAMEWEEK_BOARDS = `
  query GetGameweekBoards($eventId: Int!) {
    event(id: $eventId) {
      id
      deadlineTime
      finished
      isCurrent
      isNext
    }
    dreamTeam: liveScores(eventId: $eventId, filter: { inDreamTeam: true }) {
      player {
        id
        webName
        position
        price
        team {
          name
          shortName
        }
      }
      inDreamTeam
      minutes
      goalsScored
      assists
      cleanSheets
      bonus
      totalPoints
    }
    hauls: liveScores(eventId: $eventId, filter: { minTotalPoints: 10 }) {
      player {
        id
        webName
        position
        price
        team {
          name
          shortName
        }
      }
      inDreamTeam
      minutes
      goalsScored
      assists
      cleanSheets
      bonus
      totalPoints
    }
    liveSnapshot(eventId: $eventId) {
		season
      eventId
      state
		revisions {
			publicationId
			generation
			lifecycle
			fixtureIdentity
			scoreCore
			displayStats
			explain
			picksBase
			officialAdjustment
			previousTotals
			finalResult
			rules
			algorithm
			input
		}
		times {
			sourceCheckedAt
			contentUpdatedAt
			publishedAt
			checkpointedAt
			servedAt
			staleAt
			nextRefreshAt
		}
		delivery { state servedFrom reasonCodes }
    }
  }
`

export interface GameweekBoardEvent {
	id: number
	deadlineTime: string | null
	finished: boolean
	isCurrent: boolean
	isNext: boolean
}

export interface GameweekBoardsResponse {
	event: GameweekBoardEvent | null
	dreamTeam: LiveScore[]
	hauls: LiveScore[]
	liveSnapshot: LiveSnapshotStatus | null
}

export const GET_LIVE_POINTS = `
  query GetLiveCalcPoints($eventId: Int!, $entryId: Int!) {
    calcLivePointsByEntry(eventId: $eventId, entryId: $entryId) {
      entry
      event
      availability
      entryName
      playerName
      chip
      score {
        eventPoints
        netEventPoints
        totalPoints
        totalScope
        transferCost
        source
		calculationMode
			revisions {
				scoreCore
				picksBase
				officialAdjustment
				previousTotals
				finalResult
				input
			}
			times {
				sourceCheckedAt
				contentUpdatedAt
				publishedAt
				nextRefreshAt
			}
			delivery { state }
				}
		      snapshot {
			eventId
			state
		      }
		      rank {
			overallRank
	      }
	      captainName
      pickList {
        element
        elementType
        position
        webName
        teamName
        teamShortName
        minutes
        goalsScored
        assists
        cleanSheets
        goalsConceded
        defensiveContribution
        ownGoals
        penaltiesSaved
        penaltiesMissed
        yellowCards
        redCards
        saves
        bonus
        bps
        totalPoints
        starts
	        isGwStarted
	        isGwFinished
        isPlayed
        isCaptain
        isViceCaptain
        multiplier
        pickActive
        autoSub
        bgw
        expectedGoals
        expectedAssists
	        expectedGoalInvolvements
	        expectedGoalsConceded
	      }
    }
  }
`

// Types for live points query
export interface LivePick {
	element: number
	elementType: number
	position: number
	webName: string
	teamName: string
	teamShortName: string
	minutes: number
	goalsScored: number
	assists: number
	cleanSheets: number
	goalsConceded: number
	defensiveContribution: number
	ownGoals: number
	penaltiesSaved: number
	penaltiesMissed: number
	yellowCards: number
	redCards: number
	saves: number
	bonus: number
	bps: number
	totalPoints: number
	starts: boolean | null
	isGwStarted: boolean
	isGwFinished: boolean
	isPlayed: boolean
	isCaptain: boolean
	isViceCaptain: boolean
	multiplier?: number
	pickActive?: boolean
	autoSub?: boolean
	bgw?: boolean
	expectedGoals: number | null
	expectedAssists: number | null
	expectedGoalInvolvements: number | null
	expectedGoalsConceded: number | null
	inDreamTeam: boolean
}

export interface LiveCalcData {
	entry: number
	event: number
	availability: 'READY' | 'PENDING' | 'NO_PICKS' | 'UNAVAILABLE'
	delivery: LiveDelivery
	snapshot: LiveSnapshotStatus
	score: LivePointsScore
	rank: LiveRank | null
	provisional: boolean
	entryName: string
	playerName: string
	region: string | null
	chip: string
	startedEvent: number
	value: number
	bank: number
	teamValue: number
	totalTransfers: number
	lastValue: number
	played: number
	toPlay: number
	playedCaptain: number
	activeCaptain: { id: number; name: string; points: number }
	captainName: string
	pickList: LivePick[]
}

export interface LiveRevisionVector {
	publicationId: string
	generation: number
	lifecycle: string
	fixtureIdentity: string
	scoreCore: string
	displayStats: string
	explain: string
	picksBase: string | null
	officialAdjustment: string | null
	previousTotals: string | null
	finalResult: string | null
	rules: string
	algorithm: string
	input: string
}

export interface LiveTimes {
	sourceCheckedAt: string
	contentUpdatedAt: string
	publishedAt: string
	checkpointedAt: string | null
	servedAt: string
	staleAt: string
	nextRefreshAt: string | null
}

export interface LiveDelivery {
	state: 'FRESH' | 'STALE' | 'DEGRADED' | 'FINAL' | 'UNAVAILABLE'
	servedFrom:
		| 'REDIS_CURRENT'
		| 'REDIS_PREVIOUS'
		| 'PROCESS_LKG'
		| 'POSTGRES_CHECKPOINT'
		| 'FINAL_RESULT'
		| 'UNAVAILABLE'
	reasonCodes: string[]
}

export interface LivePointsScore {
	eventPoints: number
	netEventPoints: number
	totalPoints: number | null
	totalScope: 'OVERALL' | 'UNKNOWN'
	transferCost: number
	source: 'FPL_EVENT_LIVE' | 'FPL_FINAL_RESULT' | 'UNAVAILABLE'
	calculationMode: 'PROJECTED_AUTOSUBS' | 'FINAL_RESULT'
	revisions: LiveRevisionVector
	times: LiveTimes
	delivery: LiveDelivery
}

export interface LiveRank {
	eventRank: number | null
	overallRank: number | null
	leagueRank: number | null
	revision: string | null
	contentUpdatedAt: string | null
	state: LiveDelivery['state']
}

export interface LiveCalcDataResponse {
	liveSnapshot?: LiveSnapshotStatus | null
	calcLivePointsByEntry: LiveCalcData
}

export type LiveSnapshotState =
	| 'PRE_DEADLINE'
	| 'PICKS_WAIT'
	| 'PICKS_PROBE'
	| 'PICKS_SYNC'
	| 'LIVE_ACTIVE'
	| 'BETWEEN_FIXTURES'
	| 'DAY_SETTLING'
	| 'GW_REVIEW'
	| 'FINALIZED'
	| 'PRESEASON'
	| 'BETWEEN_GAMEWEEKS'
	| 'OFFSEASON'
	| 'UNAVAILABLE'

export interface LiveSnapshotStatus {
	season?: string
	eventId: number
	state: LiveSnapshotState
	/** Window metadata used by matches/tournament transition polling. */
	windowState?: LiveWindowState
	dataAvailability?: LiveDataAvailability
	revisions?: LiveRevisionVector
	times?: LiveTimes
	delivery?: LiveDelivery
	publicationId?: string | null
	scoreCoreRevision?: string | null
	contentUpdatedAt?: string | null
	sourceCheckedAt?: string | null
	publishedAt?: string | null
	nextRefreshAt?: string | null
}

export interface LiveSnapshotResponse {
	liveSnapshot: LiveSnapshotStatus | null
}

export const GET_LIVE_MATCHDAY = `
	query GetLiveMatchdayV3($eventId: Int) {
		liveMatchday(eventId: $eventId) {
			availability
			delivery { state servedFrom reasonCodes }
			snapshot {
				season
				eventId
				state
					revisions {
						deskPublicationId
						deskGeneration
						lifecycle
						fixtureIdentity
						scoreState
						detailObservation
						detailPublicationId
						detailGeneration
						playerDetail
				}
				times {
					deskSourceCheckedAt
					deskContentUpdatedAt
					deskPublishedAt
					deskStaleAt
					detailSourceCheckedAt
					detailContentUpdatedAt
					detailPublishedAt
					detailStaleAt
					servedAt
					nextRefreshAt
				}
				detailDelivery { state servedFrom reasonCodes }
				matches {
					fixtureId
					eventId
					homeTeamId
					homeTeamName
					homeTeamShortName
					awayTeamId
					awayTeamName
					awayTeamShortName
					homeScore
					awayScore
					kickoffTime
					minutes
					started
					finished
					finishedProvisional
					players {
						id
						webName
						position
						teamId
						price
						totalPoints
						stats { identifier value }
					}
				}
			}
		}
	}
`

export const GET_LIVE_MATCHDAY_HEAD = `
	query GetLiveMatchdayHeadV3($eventId: Int) {
		liveMatchday(eventId: $eventId) {
			availability
			delivery { state servedFrom reasonCodes }
			snapshot {
				season
				eventId
				state
				revisions {
					deskPublicationId
					deskGeneration
					lifecycle
					fixtureIdentity
					scoreState
					detailObservation
				}
				times {
					deskSourceCheckedAt
					deskContentUpdatedAt
					deskPublishedAt
					deskStaleAt
					detailSourceCheckedAt
					detailContentUpdatedAt
					detailPublishedAt
					detailStaleAt
					servedAt
					nextRefreshAt
				}
				detailDelivery { state servedFrom reasonCodes }
			}
		}
	}
`

export type LiveMatchdayAvailability = 'READY' | 'UNAVAILABLE'

export type LiveMatchdayDeliveryState =
	'FRESH' | 'STALE' | 'DEGRADED' | 'FINAL' | 'PENDING' | 'UNAVAILABLE'

export type LiveMatchdayServedFrom =
	'REDIS_CURRENT' | 'REDIS_PREVIOUS' | 'PROCESS_LKG' | 'POSTGRES_CHECKPOINT'

export interface LiveMatchdayDelivery {
	state: LiveMatchdayDeliveryState
	servedFrom: LiveMatchdayServedFrom | null
	reasonCodes: string[]
}

export interface LiveMatchdayRevisionVector {
	deskPublicationId: string
	deskGeneration: number
	lifecycle: string
	fixtureIdentity: string
	scoreState: string
	detailObservation: string | null
	detailPublicationId: string | null
	detailGeneration: number | null
	playerDetail: string | null
}

export interface LiveMatchdayTimes {
	deskSourceCheckedAt: string
	deskContentUpdatedAt: string
	deskPublishedAt: string
	deskStaleAt: string | null
	detailSourceCheckedAt: string | null
	detailContentUpdatedAt: string | null
	detailPublishedAt: string | null
	detailStaleAt: string | null
	servedAt: string
	nextRefreshAt: string | null
}

export interface LiveMatchdayPlayerStat {
	identifier: string
	value: number
	/** Requested by Mini; omitted from the Web FULL projection to save bytes. */
	awardedPoints?: number
}

export interface LiveMatchdayPlayer {
	id: number
	webName: string
	position: 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD'
	teamId: number
	/** Current canonical FPL price in tenths of £m. */
	price: number
	totalPoints: number
	stats: LiveMatchdayPlayerStat[]
}

export interface LiveMatchdayFixture {
	fixtureId: number
	eventId: number
	homeTeamId: number
	homeTeamName: string
	homeTeamShortName: string
	awayTeamId: number
	awayTeamName: string
	awayTeamShortName: string
	homeScore: number | null
	awayScore: number | null
	kickoffTime: string | null
	minutes: number
	started: boolean
	finished: boolean
	finishedProvisional: boolean
	players: LiveMatchdayPlayer[]
}

export type LiveMatchdayState =
	| 'PRE_DEADLINE'
	| 'LIVE_ACTIVE'
	| 'BETWEEN_FIXTURES'
	| 'DAY_SETTLING'
	| 'GW_REVIEW'
	| 'FINALIZED'

export interface LiveMatchdaySnapshot {
	season: string
	eventId: number
	state: LiveMatchdayState
	revisions: LiveMatchdayRevisionVector
	times: LiveMatchdayTimes
	detailDelivery: LiveMatchdayDelivery
	matches: LiveMatchdayFixture[]
}

export interface LiveMatchdayResult {
	availability: LiveMatchdayAvailability
	delivery: LiveMatchdayDelivery
	snapshot: LiveMatchdaySnapshot | null
}

export interface LiveMatchdayResponse {
	liveMatchday: LiveMatchdayResult
}

export type LiveMatchdayHeadSnapshot = Omit<
	LiveMatchdaySnapshot,
	'matches' | 'revisions'
> & {
	revisions: Pick<
		LiveMatchdayRevisionVector,
		| 'deskPublicationId'
		| 'deskGeneration'
		| 'lifecycle'
		| 'fixtureIdentity'
		| 'scoreState'
		| 'detailObservation'
	> & {
		/** FULL-only fields are not selected by the HEAD operation. */
		detailPublicationId?: null
		detailGeneration?: null
		playerDetail?: null
	}
}

export interface LiveMatchdayHeadResult {
	availability: LiveMatchdayAvailability
	delivery: LiveMatchdayDelivery
	snapshot: LiveMatchdayHeadSnapshot | null
}

export interface LiveMatchdayHeadResponse {
	liveMatchday: LiveMatchdayHeadResult
}

/** Home only needs the immutable fixture identity and live score overlay. */
export const GET_LIVE_MATCHDAY_FIXTURE_SUMMARY = `
		query GetLiveMatchdayDeskV3($eventId: Int!) {
		liveMatchday(eventId: $eventId) {
			availability
			delivery { state servedFrom reasonCodes }
			snapshot {
				season
				eventId
				state
				revisions {
					deskPublicationId
					deskGeneration
					lifecycle
					fixtureIdentity
					scoreState
				}
				times {
					deskSourceCheckedAt
					deskContentUpdatedAt
					deskPublishedAt
					deskStaleAt
					servedAt
					nextRefreshAt
				}
				matches {
					fixtureId
					eventId
					homeTeamId
					homeTeamName
					homeTeamShortName
					awayTeamId
					awayTeamName
					awayTeamShortName
					homeScore
					awayScore
					kickoffTime
					minutes
					started
					finished
					finishedProvisional
				}
			}
		}
	}
`

export type LiveMatchdayFixtureSummary = Omit<LiveMatchdayFixture, 'players'>

export interface LiveMatchdaySummarySnapshot {
	season: string
	eventId: number
	state: LiveMatchdayState
	revisions: Pick<
		LiveMatchdayRevisionVector,
		| 'deskPublicationId'
		| 'deskGeneration'
		| 'lifecycle'
		| 'fixtureIdentity'
		| 'scoreState'
	>
	times: Pick<
		LiveMatchdayTimes,
		| 'deskSourceCheckedAt'
		| 'deskContentUpdatedAt'
		| 'deskPublishedAt'
		| 'deskStaleAt'
		| 'servedAt'
		| 'nextRefreshAt'
	>
	matches: LiveMatchdayFixtureSummary[]
}

export interface LiveMatchdayFixtureSummaryResponse {
	liveMatchday: {
		availability: LiveMatchdayAvailability
		delivery: LiveMatchdayDelivery
		snapshot: LiveMatchdaySummarySnapshot | null
	}
}

export const GET_LIVE_CONTEXT = `
	query GetLiveContext {
		coreEventContext {
			season
			revision
			sourceCheckedAt
			currentEventId
			nextEventId
			nextDeadlineTime
			latestFinishedEventId
		}
		liveContext {
			season
			coreRevision
	      eventId: currentEventId
      nextEventId
      anchorEventId
      latestFinalizedEventId
      scoreCoreRevision
      state
      windowState
      producerState
      anchorMode
      dataAvailability
      nextRefreshAt
      publishedAt
	      sourceCheckedAt
	      source
	      stale
	      revisions {
			publicationId generation lifecycle fixtureIdentity scoreCore displayStats
			explain picksBase officialAdjustment previousTotals finalResult rules algorithm input
		}
		times { sourceCheckedAt contentUpdatedAt publishedAt checkpointedAt servedAt staleAt nextRefreshAt }
		delivery { state servedFrom reasonCodes }
	    }
  }
`

export interface LiveContextResponse {
	coreEventContext: CoreEventContextData
	liveContext: {
		season: string
		eventId: number | null
		nextEventId: number | null
		scoreCoreRevision: string | null
		state: LiveSnapshotState
		windowState: LiveWindowState
		producerState: LiveProducerState
		anchorMode: LiveAnchorMode
		dataAvailability: LiveDataAvailability
		anchorEventId: number | null
		latestFinalizedEventId: number | null
		publishedAt: string | null
		sourceCheckedAt: string | null
		nextRefreshAt: string | null
		source: LiveSnapshotSource | null
		stale: boolean
		revisions: LiveRevisionVector
		times: LiveTimes
		delivery: LiveDelivery
	} | null
}

export type LiveSnapshotSource =
	| 'REDIS_CURRENT'
	| 'REDIS_PREVIOUS'
	| 'POSTGRES_CHECKPOINT'
	| 'PROCESS_LKG'
	| 'FINAL_RESULT'
	| 'UNAVAILABLE'

export type LiveWindowState =
	| 'PRESEASON'
	| 'PRE_DEADLINE'
	| 'LIVE_ACTIVE'
	| 'DAY_SETTLING'
	| 'BETWEEN_FIXTURES'
	| 'GW_REVIEW'
	| 'FINALIZED'
	| 'BETWEEN_GAMEWEEKS'
	| 'OFFSEASON'

export type LiveProducerState =
	| 'PRE_DEADLINE'
	| 'PICKS_WAIT'
	| 'PICKS_PROBE'
	| 'PICKS_SYNC'
	| 'LIVE_ACTIVE'
	| 'BETWEEN_FIXTURES'
	| 'DAY_SETTLING'
	| 'GW_REVIEW'
	| 'FINALIZED'

export type LiveDataAvailability =
	'FRESH' | 'STALE' | 'DEGRADED' | 'FINAL' | 'UNAVAILABLE'

export type LiveAnchorMode =
	'UPCOMING' | 'CURRENT' | 'PREVIOUS_FINAL' | 'OFFSEASON'

export const GET_EVENT_LIVE_EXPLAIN = `
  query EventLiveExplainPlayer($eventId: Int!, $elementId: Int!) {
    eventLiveExplain(eventId: $eventId, elementId: $elementId) {
      elementId
      selectedBy
      stats {
        minutes
        goalsScored
        assists
        cleanSheets
        goalsConceded
        ownGoals
        penaltiesSaved
        penaltiesMissed
        yellowCards
        redCards
        saves
        defensiveContribution
        bonus
      }
      contributions {
        identifier
        value
        points
      }
      player {
        id
        webName
        team {
          id
          shortName
        }
      }
    }
  }
`

export const GET_EVENT_LIVE_EXPLAINS = `
  query EventLiveExplainBatch($eventId: Int!, $elementIds: [Int!]!) {
    eventLiveExplains(eventId: $eventId, elementIds: $elementIds) {
      elementId
      stats {
        minutes
        goalsScored
        assists
        cleanSheets
        goalsConceded
        ownGoals
        penaltiesSaved
        penaltiesMissed
        yellowCards
        redCards
        saves
        defensiveContribution
        bonus
      }
      contributions {
        identifier
        value
        points
      }
    }
  }
`

export interface PlayerBreakdownStat {
	identifier: string
	value: number | null
	points: number
}

export interface PlayerBreakdownEntry {
	fixtureId: number
	stats: PlayerBreakdownStat[]
}

export interface EventLiveExplainItem {
	elementId: number
	stats?: {
		minutes?: number | null
		goalsScored?: number | null
		assists?: number | null
		cleanSheets?: number | null
		goalsConceded?: number | null
		ownGoals?: number | null
		penaltiesSaved?: number | null
		penaltiesMissed?: number | null
		yellowCards?: number | null
		redCards?: number | null
		saves?: number | null
		defensiveContribution?: number | null
		bonus?: number | null
	}
	selectedBy?: number | null
	player?: {
		id: number
		webName: string
		team: {
			id: number
			shortName: string
		} | null
	} | null
	contributions?: PlayerBreakdownStat[]
	breakdown?: PlayerBreakdownEntry[]
}

export interface EventLiveExplainResponse {
	eventLiveExplain: EventLiveExplainItem | null
}

export interface EventLiveExplainsResponse {
	eventLiveExplains: EventLiveExplainItem[]
}

export const GET_PLAYER_LIVE = `
  query PlayerLive($playerId: Int!, $eventId: Int) {
    playerLive(playerId: $playerId, eventId: $eventId) {
      minutes
      goalsScored
      assists
      cleanSheets
      goalsConceded
      ownGoals
      penaltiesSaved
      penaltiesMissed
      yellowCards
      redCards
      saves
      defensiveContribution
      bonus
      bps
      totalPoints
    }
  }
`

export interface PlayerLiveStats {
	minutes: number
	goalsScored: number
	assists: number
	cleanSheets: number
	goalsConceded: number
	ownGoals: number
	penaltiesSaved: number
	penaltiesMissed: number
	yellowCards: number
	redCards: number
	saves: number
	defensiveContribution: number
	bonus: number
	bps: number
	totalPoints: number
}

export interface PlayerLiveResponse {
	playerLive: PlayerLiveStats | null
}
