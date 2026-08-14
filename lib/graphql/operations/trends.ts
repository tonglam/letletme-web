export const GET_TREND_COHORTS = `
  query TrendCohorts($access: TrendCohortAccess!) {
    trendCohorts(access: $access) {
      season
      revision
      cohorts {
        id kind access displayName exact latestEventId revision availability
        capabilities { capability state }
      }
    }
  }
`

export const GET_TREND_COHORT_SNAPSHOT = `
  query TrendCohortSnapshot($cohortId: ID!, $eventId: Int!, $limit: Int!, $access: TrendCohortAccess!) {
    trendCohortSnapshot(cohortId: $cohortId, eventId: $eventId, limit: $limit, access: $access) {
      eventId
      cohort { id displayName kind access exact latestEventId revision availability capabilities { capability state } }
      sections {
        capability state
        evidenceContext { availabilityState coverageState exact denominator sampleSize methodKey methodVersion limitations }
        rows { elementId playerName playerPosition teamShortName count percentage }
      }
    }
  }
`

export type TrendAccess = 'PUBLIC' | 'MINE'

export type TrendCapabilityStatus = { capability: string; state: string }
export type TrendCohort = {
	id: string
	kind: string
	access: TrendAccess
	displayName: string
	exact: boolean
	latestEventId: number | null
	revision: string | null
	availability: string
	capabilities: TrendCapabilityStatus[]
}

export type TrendCohortsResponse = {
	trendCohorts: { season: string; revision: string; cohorts: TrendCohort[] }
}

export type TrendDeskRow = {
	elementId: number
	playerName: string
	playerPosition: number
	teamShortName: string
	count: number
	percentage: number | null
}

export type TrendDeskSection = {
	capability: string
	state: string
	evidenceContext: {
		availabilityState: string
		coverageState: string
		exact: boolean
		denominator: number | null
		sampleSize: number | null
		methodKey: string
		methodVersion: string
		limitations: string[]
	}
	rows: TrendDeskRow[] | null
}

export type TrendDesk = {
	eventId: number
	cohort: TrendCohort
	sections: TrendDeskSection[]
}

export type TrendDeskResponse = { trendCohortSnapshot: TrendDesk }
