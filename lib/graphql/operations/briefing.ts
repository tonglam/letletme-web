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
export type BriefingState =
	| 'READY'
	| 'EMPTY'
	| 'STALE'
	| 'OFFSEASON'
	| 'UNAVAILABLE'
	| 'REMOVED'

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
	state: BriefingState
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
		state: BriefingState
		canonicalSlug: string | null
		story: BriefingStoryCard | null
	} | null
}

export type BriefingWeekResponse = {
	briefingWeek: BriefingWeek
}
