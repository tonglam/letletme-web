---
name: GraphQL Price History API
overview: Define and roll out the GraphQL API additions needed to support real player price history and robust player selection data for the price changes page.
todos:
  - id: schema-contract
    content: Add PlayerValueHistoryItem type, PriceChangeType enum, and playerValueHistory query to GraphQL schema.
    status: pending
  - id: resolver-service
    content: Implement resolver and service/data-access path with sorting, validation, and unit-consistent values.
    status: pending
  - id: query-enhancement
    content: Enhance existing playerValues payload with teamShortName and canonical position while preserving compatibility.
    status: pending
  - id: tests-docs
    content: Add integration/unit tests and publish docs/changelog with sample query/response and constraints.
    status: pending
isProject: false
---

# letletme-graphql Plan: Price History API

## Objective

Add dedicated GraphQL capabilities so frontend can fetch true historical player price changes (not just latest snapshot), with typed and stable contracts.

## Scope

Backend GraphQL work only:

- schema additions
- resolver/service/data-access implementation
- validation and error behavior
- contract tests and docs

## API Contract Design

### New query

- `playerValueHistory(playerId: Int!, limit: Int, fromDate: DateTime, toDate: DateTime): [PlayerValueHistoryItem!]!`

### New type

- `PlayerValueHistoryItem`
  - `playerId: Int!`
  - `changeDate: DateTime!`
  - `oldValue: Int!` (tenths, same unit as existing `value`)
  - `newValue: Int!`
  - `changeType: PriceChangeType!` (`RISE | FALL | UNCHANGED`)
  - `transfersIn: Int`
  - `transfersOut: Int`

### Supporting enum

- `PriceChangeType`
  - `RISE`
  - `FALL`
  - `UNCHANGED`

### Non-breaking enhancement to existing query

- Extend `playerValues` payload with:
  - `teamShortName: String!`
  - canonical `position` enum if available

## Resolver & Service Behavior

- Resolve `playerValueHistory` from historical value source table/log.
- Default sorting: `changeDate DESC`.
- Input rules:
  - `limit` default 30, max 365.
  - if `fromDate > toDate`, return validation error.
- Empty data returns `[]` (not null).
- Missing player returns `[]` unless your API standard prefers user-facing error; follow existing API conventions.

## Performance & Indexing

- Ensure DB index on `(player_id, change_date DESC)`.
- Query path should avoid N+1 and compute `changeType` in service layer or SQL projection.
- Add optional dataloader/cache only if profiling shows need.

## Security & Stability

- Read-only endpoint behavior.
- No credentials or secrets in schema responses/logs.
- Keep old `playerValues` fields intact for compatibility.

## Test Plan (Backend)

- Unit tests:
  - `changeType` calculation
  - validation (`limit`, date range)
- Integration tests:
  - history query success path
  - empty result path
  - sorted descending order
  - nullable transfer fields
- Contract snapshot test for response shape

## Rollout Plan

1. Add schema and resolver behind feature flag (optional).
2. Deploy backend with new query.
3. Verify via GraphQL playground/query tests.
4. Coordinate frontend switch to history query.
5. Remove temporary snapshot-only UI messaging after frontend adoption.

## Deliverables

- Updated GraphQL schema files
- Resolver + service + repository/data-source updates
- Test coverage for query and contract
- API docs/changelog entry with example query and response
