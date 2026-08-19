export const GET_BRIEFING_WEEK = `
  query BriefingWeek($locale: BriefingLocale!) {
    briefingWeek(locale: $locale) {
      state
      revision
      publicationId
      publishedAt
      sourceCheckedAt
      staleAt
      event {
        seasonCode
        eventId
        name
        deadlineTime
      }
      featured {
        id
        slug
        storyRevision
        title
        summary
        sourceName
        sourceUrl
        sourceCheckedAt
        expiresAt
      }
      sections {
        key
        title
        items {
          id
          slug
          storyRevision
          title
          summary
          sourceName
          sourceUrl
          sourceCheckedAt
          expiresAt
        }
      }
    }
  }
`

export const GET_BRIEFING_STORY = `
  query BriefingStory($slug: String!, $locale: BriefingLocale!) {
    briefingStory(slug: $slug, locale: $locale) {
      state
      canonicalSlug
      story {
        id
        slug
        storyRevision
        title
        summary
        sourceName
        sourceUrl
        sourceCheckedAt
        expiresAt
      }
    }
  }
`

export type BriefingLocaleVariable = 'EN' | 'ZH_CN'
export type BriefingWeekState =
	| 'READY'
	| 'EMPTY'
	| 'STALE'
	| 'OFFSEASON'
	| 'UNAVAILABLE'
export type BriefingStoryState =
	| 'READY'
	| 'CORRECTED'
	| 'REMOVED'
	| 'UNAVAILABLE'
export type BriefingState = BriefingWeekState | BriefingStoryState

const BRIEFING_STATES = new Set<BriefingState>([
	'READY',
	'EMPTY',
	'STALE',
	'OFFSEASON',
	'UNAVAILABLE',
	'CORRECTED',
	'REMOVED',
])

export function isBriefingState(value: string): value is BriefingState {
	return BRIEFING_STATES.has(value as BriefingState)
}

export function isRenderableBriefingStoryState(
	state: BriefingState
): state is 'READY' | 'CORRECTED' {
	return state === 'READY' || state === 'CORRECTED'
}

export type BriefingStoryCard = {
	id: string
	slug: string
	storyRevision: number
	title: string
	summary: string
	sourceName: string | null
	sourceUrl: string | null
	sourceCheckedAt: string | null
	expiresAt: string | null
}

export type BriefingSection = {
	key: string
	title: string
	items: BriefingStoryCard[]
}

export type BriefingWeek = {
	state: BriefingWeekState
	revision: number | null
	publicationId: string | null
	publishedAt: string | null
	sourceCheckedAt: string | null
	staleAt: string | null
	event: {
		seasonCode: string
		eventId: number
		name: string
		deadlineTime: string
	} | null
	featured: BriefingStoryCard[]
	sections: BriefingSection[]
}

export type BriefingStoryResponse = {
	briefingStory: {
		state: BriefingStoryState
		canonicalSlug: string | null
		story: BriefingStoryCard | null
	} | null
}

export type BriefingWeekResponse = {
	briefingWeek: BriefingWeek
}
