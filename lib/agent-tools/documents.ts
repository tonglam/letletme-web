export const CORE_CONTEXT_DOCUMENT = `
  query AgentCoreContext {
    coreEventContext {
      season revision sourceCheckedAt currentEventId nextEventId nextDeadlineTime latestFinishedEventId
    }
  }
`

export const CONTEXT_DOCUMENT = `
  query AgentContext($locale: BriefingLocale!) {
    coreEventContext {
      season revision sourceCheckedAt currentEventId nextEventId nextDeadlineTime latestFinishedEventId
    }
    marketSnapshotContext { season revision source snapshotDate capturedAt rowCount }
    briefingWeek(locale: $locale) {
      state revision publicationId publishedAt sourceCheckedAt staleAt
      event { seasonCode eventId name deadlineTime }
      featured { id }
      sections { key items { id } }
    }
  }
`

export const PLAYERS_DOCUMENT = `
  query AgentPlayers(
    $search: String
    $filter: PlayersFilter
    $sort: PlayerPickerSort!
    $ownershipBand: PlayerPickerOwnershipBand
    $limit: Int!
    $cursor: Int
  ) {
    coreEventContext { season revision sourceCheckedAt }
    marketSnapshotContext { season revision source snapshotDate capturedAt rowCount }
    playersForPicker(
      search: $search
      filter: $filter
      sort: $sort
      ownershipBand: $ownershipBand
      limit: $limit
      cursor: $cursor
    ) {
      totalCount
      nextCursor
      items {
        id webName position price selectedByPercent totalPoints form
        team { id name shortName }
      }
    }
  }
`

export const PLAYER_CATALOG_DOCUMENT = `
  query AgentPlayerCatalog($eventId: Int!) {
    teamSelectionDesk(eventId: $eventId, horizon: 1) {
      season coreRevision marketRevision checkedAt eventId
      playerPool { state checkedAt message }
      players {
        id webName position price ownership form totalPoints status news chanceOfPlaying
        team { id name shortName }
      }
    }
  }
`

export const GAMEWEEK_DOCUMENT = `
  query AgentGameweek($eventId: Int!, $horizon: Int!) {
    teamSelectionDesk(eventId: $eventId, horizon: $horizon) {
      season coreRevision marketRevision checkedAt deadline phase eventId horizon
      rules {
        squadSize startingSize budget maxPlayersPerTeam currencyMultiplier
        positions { id name shortName squadSelect minPlay maxPlay }
        chips { id name number startEvent stopEvent chipType }
      }
      players {
        id webName position price ownership form totalPoints status news chanceOfPlaying
        team { id name shortName }
      }
      fixtures {
        id eventId kickoffTime homeDifficulty awayDifficulty
        homeTeam { id name shortName }
        awayTeam { id name shortName }
      }
      playerPool { state checkedAt message }
      fixtureSection { state checkedAt message }
      rulesSection { state checkedAt message }
    }
  }
`

export const MARKET_DOCUMENT = `
  query AgentMarket($days: Int!, $period: MarketOwnershipPeriod!, $limit: Int!) {
    coreEventContext { season revision sourceCheckedAt }
    marketSnapshotContext { season revision source snapshotDate capturedAt rowCount }
    marketLineup {
      formation totalOwnershipPercent
      slots {
        row col
        player { playerId webName teamId teamName teamShortName position price selectedByPercent }
      }
    }
    marketOwnershipOverview(period: $period, limit: $limit) {
      period
      gameweek { id name deadlineTime }
      coverage {
        status requestedDays observedDays firstDate latestDate fromDate toDate missingDates
        capturedAt complete stale
      }
      risers {
        fromSelectedByPercent toSelectedByPercent changePercentagePoints fromDate toDate
        player { playerId webName teamId teamName teamShortName position price selectedByPercent }
      }
      fallers {
        fromSelectedByPercent toSelectedByPercent changePercentagePoints fromDate toDate
        player { playerId webName teamId teamName teamShortName position price selectedByPercent }
      }
    }
    marketPulse(days: $days) {
      coverage { requestedDays observedDays firstDate latestDate capturedAt complete stale }
      mostSelected { playerId webName teamId teamName teamShortName position price selectedByPercent }
      transferMovers {
        transfersIn transfersOut netTransfers
        player { playerId webName teamId teamName teamShortName position price selectedByPercent }
      }
      availabilityHighlights {
        status previousStatus news newsAdded observedDate chanceOfPlayingThisRound chanceOfPlayingNextRound
        player { playerId webName teamId teamName teamShortName position price selectedByPercent }
      }
      newPlayers {
        firstObservedDate
        player { playerId webName teamId teamName teamShortName position price selectedByPercent }
      }
      priceChanges {
        changeDate oldPrice newPrice change direction
        player { playerId webName teamId teamName teamShortName position price selectedByPercent }
      }
      availabilityUpdateCount
    }
  }
`

export const ENTRY_SNAPSHOT_DOCUMENT = `
  query AgentEntrySnapshot($id: Int!) {
    coreEventContext { season revision sourceCheckedAt }
    entrySnapshot(id: $id) {
      id entryName playerName region startedEvent overallPoints overallRank bank teamValue totalTransfers
    }
  }
`

export const ENTRY_SEARCH_DOCUMENT = `
  query AgentEntrySearch($query: String!, $limit: Int!) {
    coreEventContext { season revision sourceCheckedAt }
    searchEntries(query: $query, limit: $limit) {
      id entryName playerName region startedEvent overallPoints overallRank bank teamValue totalTransfers
    }
  }
`

export const OWN_ENTRY_DOCUMENT = `
  query AgentOwnEntry($id: Int!, $eventId: Int) {
    coreEventContext { season revision sourceCheckedAt }
    entrySnapshot(id: $id) {
      id entryName playerName region startedEvent overallPoints overallRank bank teamValue totalTransfers
    }
    myFplTeamDesk(eventId: $eventId) {
      state
      context { season coreRevision currentEventId nextEventId latestFinalizedEventId }
      entry {
        id entryName playerName region startedEvent overallPoints overallRank bank teamValue totalTransfers
      }
      history {
        eventId eventPoints eventRank overallPoints overallRank eventTransfers eventTransfersCost
        eventNetPoints eventBenchPoints eventChip eventCaptainPoints captainWebName teamValue bank
      }
      pastSeasons { season totalPoints overallRank }
      selectedEventId
      gameweek {
        state eventId
        result {
          eventId eventPoints overallPoints overallRank eventTransfers eventTransfersCost eventNetPoints
          eventBenchPoints eventChip eventCaptainPoints playedCaptainWebName teamValue bank
          picks {
            element position webName teamShortName elementTypeName isCaptain isViceCaptain multiplier
            totalPoints minutes againstShortName wasHome score isPlayed autoSub
          }
        }
      }
    }
  }
`

export const COMPETITION_DOCUMENT = `
  query AgentCompetition(
    $competitionId: Int!
    $entryId: Int!
    $eventId: Int!
    $limit: Int!
    $offset: Int!
  ) {
    coreEventContext { season revision sourceCheckedAt }
    tournament(tournamentId: $competitionId, entryId: $entryId) {
      id name creator adminEntryId leagueId leagueType sourceLeagueName rosterMode rosterSyncStatus
      rosterLastSyncedAt totalTeamNum tournamentMode groupMode groupTeamNum groupNum
      groupStartedEventId groupEndedEventId groupRounds groupPlayAgainstNum groupQualifyNum
      knockoutMode knockoutTeamNum knockoutRounds knockoutEventNum knockoutStartedEventId
      knockoutEndedEventId knockoutPlayAgainstNum state setupStatus setupPhase setupCompletedUnits
      setupTotalUnits setupProgressUpdatedAt standingsReadyAt setupHasWarnings createdAt updatedAt
    }
    tournamentEventResults(
      tournamentId: $competitionId
      eventId: $eventId
      limit: $limit
      offset: $offset
    ) {
      groupId entryId entryName playerName eventGroupRank eventPoints eventCost eventNetPoints eventRank
      overallPoints overallRank eventChip captainId captainPoints teamValue bank
      event { id name deadlineTime finished dataChecked }
      captain { id webName }
    }
  }
`

export const BRIEFING_WEEK_DOCUMENT = `
  query AgentBriefingWeek($locale: BriefingLocale!) {
    coreEventContext { season revision sourceCheckedAt }
    briefingWeek(locale: $locale) {
      state revision publicationId publishedAt sourceCheckedAt staleAt
      event { seasonCode eventId name deadlineTime }
      featured { id slug storyRevision title summary sourceName sourceUrl sourceCheckedAt expiresAt }
      sections {
        key title
        items { id slug storyRevision title summary sourceName sourceUrl sourceCheckedAt expiresAt }
      }
    }
  }
`

export const BRIEFING_STORY_DOCUMENT = `
  query AgentBriefingStory($slug: String!, $locale: BriefingLocale!) {
    coreEventContext { season revision sourceCheckedAt }
    briefingWeek(locale: $locale) { state revision publicationId publishedAt sourceCheckedAt staleAt }
    briefingStory(slug: $slug, locale: $locale) {
      state canonicalSlug
      story { id slug storyRevision title summary sourceName sourceUrl sourceCheckedAt expiresAt }
    }
  }
`

export const AGENT_GRAPHQL_DOCUMENTS = Object.freeze({
	CORE_CONTEXT_DOCUMENT,
	CONTEXT_DOCUMENT,
	PLAYERS_DOCUMENT,
	PLAYER_CATALOG_DOCUMENT,
	GAMEWEEK_DOCUMENT,
	MARKET_DOCUMENT,
	ENTRY_SNAPSHOT_DOCUMENT,
	ENTRY_SEARCH_DOCUMENT,
	OWN_ENTRY_DOCUMENT,
	COMPETITION_DOCUMENT,
	BRIEFING_WEEK_DOCUMENT,
	BRIEFING_STORY_DOCUMENT
})
