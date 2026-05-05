# Page Performance Optimisation Report

## Scope

This document records the optimisation work done on the LetLetMe web app around page loading, server/client component boundaries, and authenticated/tournament-heavy routes.

The main pages investigated were:

- `/live/tournament`
- `/live/points/[id]`
- `/stats/tournament`
- `/data/selections`
- `/profile`
- supporting public/live/stat pages used as baseline comparisons

The goal was not only to make individual pages faster, but also to establish repeatable rules for deciding what belongs in a Server Component, what belongs in a Client Component, and what data should block first render.

## Principles

### 1. First useful content should not wait for optional data

A page often needs several layers of data:

- identity/session data
- route parameters and selected filters
- primary content data
- secondary enrichment data
- interactive-only data

Only the first three should usually block the first useful render. Secondary enrichment, such as rank deltas, player detail breakdowns, or metadata labels, should update after the main content is visible.

### 2. Server Components should own initial data needed for first paint

When the first visible page depends on data, fetching it in a Server Component avoids this waterfall:

1. browser receives shell
2. JavaScript hydrates
3. client effect runs
4. GraphQL request starts
5. content finally appears

For pages such as `/data/selections`, `/live/points/[id]`, and `/stats/tournament`, moving the first data fetch to the server removed client-only loading waits.

### 3. Client Components should own interaction, filters, refresh, and background enrichment

Client Components remain the right place for:

- search input
- tabs
- selectors
- table sorting
- filters
- refresh buttons
- countdown timers
- background data enrichment

The pattern is: server fetches initial snapshot, client receives it as props, then client handles user-driven changes.

### 4. Do not fetch data that is not rendered

The clearest bug was `/live/tournament`: it fetched current gameweek and previous gameweek live tournament calculations, but the table did not display `previousRank`. The previous gameweek query was therefore wasted.

Removing unused queries is usually better than caching them.

### 5. Measure user experience, not only raw query time

We measured three milestones:

- DOM ready: browser has parsed the document.
- First visible: first meaningful UI text is visible.
- Content ready: route-specific main content is visible, not just a loading shell.

This matters because a query can take 300ms while the page takes 2s if frontend code waits for hydration, runs effects sequentially, or blocks render on secondary data.

## How We Spotted the Issues

### Page timing report

The first full sweep showed that most pages were below a few hundred milliseconds locally, while these routes were slower or unstable:

- `/live/tournament`
- `/live/points/15702`
- `/stats/tournament`
- `/profile`
- `/data/selections`

After checking repeated runs, `/profile` and `/data/selections` were stable around 350-470ms, so they were no longer the main risk. The real problem pages were the timeout or one-second-plus routes.

### Raw GraphQL timings

We then measured the GraphQL calls directly.

For `/stats/tournament`, direct GraphQL timings were roughly:

| Query | Time |
| --- | ---: |
| `GetCurrentAndNextEvents` | 239ms |
| `GetEntryTournaments(entryId: 15702)` | 104ms |
| `TournamentEventResults(t1, gw35)` | 118ms |
| `TournamentEventResults(t1, gw34)` | 111ms |
| `TournamentRankingSummary(t1, gw35, entryId: 15702)` | 101ms |

This showed that the data layer was not slow enough by itself to explain multi-second rendering. The issue was mostly orchestration: what was awaited, where it was awaited, and whether it blocked first render.

### Code path review

We traced each slow route:

- `/live/tournament` server-awaited tournament list plus two large live tournament calculations.
- `/live/points/[id]` fetched the main live data only after the client mounted.
- `/stats/tournament` fetched data from client effects after hydration and also chained secondary enrichment before final content.
- `/data/selections` previously depended on client session resolution and could start with `entryId = 0`.
- `/profile` performed unnecessary FPL entry validation during page render.

## Server and Client Component Split

### `/data/selections`

Before:

- Client page read session asynchronously.
- `entryId` could initially be `0`.
- Tournament list and initial selection stats were fetched after hydration.

After:

- `app/data/selections/page.tsx` is a Server Component.
- It reads `entryId` on the server.
- It fetches tournaments and initial selection stats before rendering.
- `app/data/selections/SelectionsClient.tsx` handles selectors and follow-up stat changes.

Result:

- Avoided the `entryId = 0` race.
- First content became stable around 330-370ms locally.

### `/live/matches`

Before:

- The route blocked or loaded primarily through client-side flow.

After:

- `app/live/matches/page.tsx` performs the initial match fetch.
- `app/live/matches/LiveMatchesClient.tsx` owns tabs, refresh, and client interaction.
- The live matches query uses a short revalidation window where appropriate.

Result:

- Local content ready around 178ms in the final sweep.

### `/live/tournament`

Before:

- Server fetched the entry tournament list.
- Server fetched current gameweek live points for all entries in selected tournament.
- Server also fetched previous gameweek live points for all entries.
- Previous rows were used to compute `previousRank`, but `previousRank` was not rendered in the table.

After:

- Removed the previous gameweek live calculation.
- The page now only fetches the selected tournament current gameweek live rows.
- `TournamentClient` still owns filters, search, selectors, ownership/team exposure filters, and table interaction.

Result:

- Removed one large duplicate GraphQL call, roughly 750-850ms raw query time.
- Local content ready is now around 1.0s.
- Remaining cost is the current tournament live calculation for all entries.

Future improvement:

- Add a slimmer GraphQL query for the initial table. The first table does not need full pick lists for every entry.
- Fetch ownership/team exposure details only when filters are opened or after the leaderboard appears.

### `/live/points/[id]`

Before:

- Server page rendered a client component.
- Client component fetched `GET_LIVE_POINTS` after hydration.
- Then it fetched `eventLiveExplain` batch for detailed breakdowns.
- The main query was fast, but user-visible content could still timeout due to client sequencing.

After:

- `app/live/points/[id]/page.tsx` fetches `GET_LIVE_POINTS` on the server.
- `TeamPointsClient` receives `initialLiveData`.
- The page renders team stats and player list immediately from the main live payload.
- `eventLiveExplain` still runs in the background to enrich detailed player stats.

Result:

- `/live/points/15702` no longer timed out.
- Final repeated local content ready was around 463-605ms.

### `/stats/tournament`

Before:

- Entire page was a Client Component.
- It waited for session hydration.
- Then it fetched tournaments.
- Then it fetched current tournament event rows.
- Then it fetched previous rows, ranking summary, and captain metadata.
- Main content depended on too much client-side work.

After:

- `app/stats/tournament/page.tsx` is a Server Component.
- It gets the entry id and current event on the server.
- It fetches the tournament list and current event rows for the selected tournament.
- `TournamentStatsClient` receives initial tournaments and current rows as props.
- Client enrichment continues for:
  - previous rank deltas
  - ranking summary
  - captain metadata
  - later tournament selection changes

Result:

- The route no longer waits for hydration to begin useful data work.
- Final local content ready was around 799-980ms in repeated runs.

Remaining cost:

- This page now mostly waits on server TTFB because the server still needs current event, tournament list, and current event rows before sending useful HTML.

Future improvement:

- Stream the shell and tournament selector first.
- Put the stats table behind a Suspense/server child.
- Or add one backend aggregate query that returns tournament list plus selected tournament rows in a single request.

### `/profile`

Before:

- The page performed `validateFplEntry()` during page load.

After:

- Removed that validation from initial profile render.
- Validation should happen only when the user actively rebinds or edits the entry.

Result:

- Stable local content ready around 430-450ms.

## Final Local Timing Snapshot

Measured against the rebuilt production server on `localhost:3000` in a logged-in browser session.

For variable authenticated pages, the median of repeated runs was used.

| Page | DOM ready | First visible | Content ready |
| --- | ---: | ---: | ---: |
| `/` | 158ms | 192ms | 195ms |
| `/auth/login` | 114ms | 136ms | 139ms |
| `/auth/signup` | 104ms | 125ms | 128ms |
| `/auth/forgot-password` | 106ms | 127ms | 130ms |
| `/auth/reset-password` | 116ms | 136ms | 139ms |
| `/auth/verify-email` | 115ms | 138ms | 140ms |
| `/data/player-stats` | 124ms | 159ms | 163ms |
| `/data/price-changes` | 105ms | 129ms | 131ms |
| `/data/selections` | 313ms | 334ms | 337ms |
| `/live/matches` | 143ms | 176ms | 178ms |
| `/live/points` | 113ms | 139ms | 141ms |
| `/live/points/15702` | 366ms | 389ms | 495ms |
| `/live/tournament` | 972ms | 1019ms | 1022ms |
| `/live/tournament/t1` | 121ms | 166ms | 168ms |
| `/onboarding/bind-entry` | 126ms | 154ms | 157ms |
| `/profile` | 406ms | 437ms | 441ms |
| `/stats/gameweek` | 109ms | 135ms | 139ms |
| `/stats/team` | 107ms | 137ms | 140ms |
| `/stats/tournament` | 925ms | 962ms | 966ms |
| `/tournament/create` | 122ms | 145ms | 148ms |
| `/tournament/list` | 123ms | 143ms | 146ms |
| `/tournament/t1` | 118ms | 138ms | 142ms |
| `/tournament/t1/manage` | 135ms | 155ms | 158ms |

## Guidelines for Other Projects

### 1. Classify data by render criticality

For every page, list data as:

- Critical: required for first useful content.
- Important but deferrable: useful, but not required for first paint.
- Interactive: only needed after user action.
- Decorative: never allowed to block content.

Only critical data should block the initial render.

### 2. Move initial snapshots to Server Components

If a page initially shows a loading state and then fetches in `useEffect`, ask whether the server can fetch that first snapshot instead.

Good candidates:

- authenticated page bootstrap
- selected tournament/list data
- current gameweek summary
- initial leaderboard rows
- entry detail page data

Bad candidates:

- keystroke search results
- modal-only data
- hover details
- background refreshes
- UI preferences

### 3. Pass initial data into Client Components

Use this shape:

```tsx
// page.tsx - Server Component
export default async function Page() {
  const initialData = await fetchInitialData()
  return <PageClient initialData={initialData} />
}
```

```tsx
// PageClient.tsx - Client Component
"use client"

export function PageClient({ initialData }) {
  const [data, setData] = useState(initialData)
  // user interactions update data later
}
```

This keeps fast first render and rich interactivity.

### 4. Watch for hidden waterfalls

Common bad patterns:

```ts
const a = await fetchA()
const b = await fetchB()
const c = await fetchC()
```

If independent, use:

```ts
const [a, b, c] = await Promise.all([fetchA(), fetchB(), fetchC()])
```

If `b` depends on `a`, ask whether the backend can provide a combined query.

### 5. Do not fetch previous/secondary data unless the UI uses it

Before keeping a query, trace it all the way to rendered UI.

Questions:

- Is the field displayed?
- Is it used for sorting/filtering?
- Is it used for a visible badge, rank delta, or stat?
- Is it only used by dead state or old code?

If not used, remove the query.

### 6. Prefer backend aggregate queries over frontend stitching

If a page always needs several related pieces of data, consider one backend query:

```graphql
tournamentStatsOverview(tournamentId, eventId, entryId) {
  tournament
  currentRows
  previousRankDeltas
  rankingSummary
  captainMeta
}
```

This avoids multiple round trips and repeated frontend mapping.

### 7. Stream shells for slow dynamic pages

If a page must fetch slow data on the server, do not make the whole page wait.

Render:

- title
- selector
- nav
- stable layout
- skeleton/table placeholder

Then stream the heavy section behind Suspense.

### 8. Keep auth on the server

Do not use `localStorage` as the source of truth for entry id or authentication. It is stale-prone and not available to the server.

Use signed session/cookie data on the server, then pass entry id to client components as needed.

`localStorage` is fine for:

- selected tab
- last selected tournament id
- collapsed panels
- theme preference

It is not good for:

- auth decisions
- current user identity
- protected route access
- authoritative entry id

### 9. Measure three user milestones

Raw query time is not enough. Use:

- DOM ready
- first visible UI
- content ready

This catches cases where the backend is fast but frontend orchestration is slow.

### 10. Repeat measurements for variable pages

Authenticated and dynamic pages can vary due to:

- session lookup
- cold server function
- backend cache state
- browser navigation queue
- large serialized payloads

Use repeated runs and report median or range, not one sample.

## Practical Checklist

Before optimising a page:

1. Measure DOM ready, first visible, and content ready.
2. Measure raw backend query times.
3. Trace every query to rendered UI.
4. Remove unused queries.
5. Move critical first-render data to the server.
6. Keep interactions in client components.
7. Defer enrichment and optional metadata.
8. Re-run typecheck, lint, build.
9. Re-measure the same routes.
10. Record before/after numbers.

## Summary

The biggest improvements came from better boundaries, not micro-optimisations.

The winning pattern was:

- Server Component fetches the initial snapshot.
- Client Component owns interaction and refresh.
- Secondary data loads after first useful content.
- Unused queries are removed.
- Measurements focus on what the user sees, not only what the backend reports.

This pattern should be reused for tournament pages, profile/account pages, live data pages, and any page that currently fetches first-render content inside `useEffect`.
