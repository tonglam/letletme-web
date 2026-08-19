# LetLetMe Product Conclusions

- **Status:** Agreed product-direction decision record
- **Recorded:** 9 August 2026
- **Last revised:** 18 August 2026
- **Scope:** LetLetMe website and its information assistant
- **Assumption:** Current in-progress web, GraphQL, and data refactors are complete and available.

> **Briefing supersession notice (18 August 2026):** All Briefing-specific navigation,
> personalization, follow/mute, acquisition, publication, and cross-repository decisions in this
> document are superseded by
> [LetLetMe Briefing — Full-Chain Architecture and Delivery Plan](letletme-briefing-content-architecture.md).
> Briefing is now a top-level section in the second navigation position, with no personal content
> state or source/topic subscriptions in V1. Non-Briefing conclusions in this document remain in
> force.

Detailed purpose, sub-page, current-implementation, and gap definitions for the four public sections are recorded in [LetLetMe Four-Section Product Specification](letletme-four-section-specification.md).

The shared identities, contracts, dependency gates, migration boundaries, and delivery order are recorded in [LetLetMe Cross-Section — High-Level Implementation Plan](letletme-cross-section-implementation-plan.md).

The cross-repository Live delivery plan is recorded in [LetLetMe Live Section — High-Level Implementation Plan](letletme-live-section-high-level-design.md).

The cross-repository My FPL delivery plan is recorded in [LetLetMe My FPL Section — High-Level Implementation Plan](letletme-my-fpl-section-high-level-design.md).

The cross-repository Competitions delivery plan is recorded in [LetLetMe Competitions Section — High-Level Implementation Plan](letletme-competitions-section-high-level-design.md).

The cross-repository Explore delivery plan is recorded in [LetLetMe Explore Section — High-Level Implementation Plan](letletme-explore-section-high-level-design.md).

The current cross-repository Briefing plan is recorded in [LetLetMe Briefing — Full-Chain Architecture and Delivery Plan](letletme-briefing-content-architecture.md).

## Executive Summary

- **LetLetMe should remain live-first.** Reliable real-time visibility into a manager's team, tracked official leagues, and custom competitions is the primary product job and the reason Live remains the first destination.
- **Live-first must not mean live-only.** LetLetMe should become the manager's persistent FPL context layer: it remembers their team, season, leagues, competitions, followed interests, and relevant changes so each return is more useful than the first visit.
- **Official leagues and custom competitions are different report scopes, not mutually exclusive sources.** One official league may supply evidence and participants to many tournaments. Official entry and league facts should be collected once and reused; every tournament keeps its own membership, rules, calculated outputs, and audit.
- **Tracked official leagues remain a resource-control product, while custom competitions remain the strongest durable differentiator.** Explicit preparation prevents arbitrary public league IDs from triggering expensive live calculation and weekly storage. Custom formats, custom membership, live competition views, and social play provide additional differentiated value.
- **Finalized review is a core trust and retention layer.** It reconciles My Team and tracked official leagues to settled official truth, finalizes custom competitions from those settled inputs, and adds personal or competition intelligence that the result alone does not provide.
- **The public information architecture should be `Live · Briefing · My FPL · Competitions · Explore`.** Briefing is deliberately second to win attention for timely real-world information; it remains globally edited, non-personalized, and non-advisory.

LetLetMe is therefore a **live-first, persistent, competition-centered, evidence-led FPL companion**. Live is its strongest entry point; accumulated personal context, custom competitions, trustworthy history, and relevant change are the reasons to return throughout the season.

The product promise is:

> **The whole gameweek. Your call.**

The first position of **Live** in the website navigation is intentional: it expresses the product's primary use occasion, not a legacy arrangement. Official FPL may become the upstream authority for more live facts, but LetLetMe should continue to own the live experience across a user's team and prepared competitions. **Briefing** owns globally edited real-world information, **My FPL** owns remembered personal context, **Competitions** owns tracked official leagues and custom play, and **Explore** makes quantitative evidence approachable.

LetLetMe is not an optimizer, prediction authority, official-game replacement, or autonomous FPL manager.

## 1. Product definition

### Main purpose

Become the manager's persistent FPL context layer: provide reliable real-time visibility into their team, deliberately tracked official leagues, and prepared custom competitions; remember the context that matters across visits; preserve the settled record; and make material outcomes understandable without taking decisions away from the manager. Before a deadline, any squad context is explicitly the latest publicly frozen squad rather than the manager's current private FPL draft.

LetLetMe spans the full gameweek cycle:

1. **Between gameweeks:** help users explore fixtures, market movement, player evidence, and field behaviour.
2. **During matches:** present reliable live team and competition results with visible provisional status.
3. **After finalization:** reconcile to official results and provide deeper personal and league review.
4. **Across the season:** track admitted official leagues, operate custom competitions, and preserve their history.
5. **At every stage:** leave the final conclusion and official action to the user.

### What LetLetMe owns

- A reliable, low-latency live experience for the user's team, tracked official leagues, and prepared custom competitions.
- Consolidated live points, player events, rank/standing movement, bonus state, and freshness information.
- The official-finalized review experience for My Team and tracked official leagues, plus the finalized LetLetMe record for custom competitions.
- Structured player, fixture, market, gameweek, team, league, and competition evidence.
- Comparison and explanation under a consistent, visible scope.
- Personal team, season-history, rival, cohort, and exposure context.
- Remembered team/league identity, followed objects, source preferences, relevant changes, and season continuity that compound across visits.
- Transparent LetLetMe-derived calculations.
- Source, freshness, coverage, denominator, and methodology visibility.
- Custom competition formats that official FPL does not provide.
- Compact, reusable, and shareable evidence views.

### What LetLetMe does not own

- Transfers, lineup changes, captaincy, or chip actions on official FPL.
- Official scoring authority when complete official facts are available.
- Arbitrary public whole-league lookup, calculation, enrichment, or persistent collection for an official league that has not passed LetLetMe's setup and resource limits.
- Home-grown expected-points or expected-minutes forecasts.
- Optimized teams, transfer solvers, or LetLetMe-generated team selections.
- LetLetMe-branded `buy`, `sell`, `avoid`, `essential`, or `best captain` verdicts.
- A newsroom, paywall-scraping operation, or generic social network.

The maximum official-team integration is a clear link to the relevant official FPL destination.

### League, tournament, and evidence definitions

- An **official league** is an upstream FPL object identified within a season by league type and league ID. Official FPL owns its identity, membership, official standings, ranks, and finalized manager results. LetLetMe may explicitly prepare it as a **tracked official league** for Live, weekly analysis, auditing, and history. This is the product previously described as an official-league mirror.
- A **tournament** is a LetLetMe-created competition with its own tournament ID, selected membership, gameweek window, format, rules, derived results, lifecycle, and audit. It may import all or some participants from an official league, but it remains a separate LetLetMe object.
- One official league may source any number of tournaments. Those tournaments are not duplicates: their participant sets, windows, formats, or rules may differ.

Efficiency comes from sharing evidence, not from blocking tournament creation:

1. **Entry evidence** is stored once per entry and gameweek: official picks, points, transfers, chips, bench, captain, and automatic substitutions.
2. **League evidence** is stored once per official league, gameweek, and entry: membership, official league rank, and source-specific context.
3. **Tournament results** are stored separately per tournament and gameweek or stage: standings, groups, matchups, brackets, and tournament-specific metrics.

League/source audits verify official coverage and freshness. Tournament audits separately verify that the tournament's declared membership and rules produced the correct derived result. Both audit levels are intentional.

## 2. The original four sections form one product lifecycle

The original website architecture was directionally sound. Its four sections were created for different moments and jobs, not as four unrelated collections of pages.

### Live: follow the gameweek while it is happening

Live Points, Live Competitions, and Live Matches were built to provide fast, reliable results when official FPL did not provide a sufficient live experience. This remains the primary matchday job even if the source of the underlying facts changes.

### Tournaments: the old architecture combines official league tracking with custom play

Tournament originally combined two distinct concepts:

1. **Tracked official Classic league:** preload a league's members and picks before matches so limited compute does not need to discover and fetch an entire league on every live request. It acts as a buffer/read model for live presentation and preserves league-level reports.
2. **LetLetMe custom competition:** let a group reuse FPL teams inside different membership, gameweek windows, groups, points races, or knockout structures for fun; the backend also contains additional battle-race models.

These concepts must be explained as different behaviours, but both remain deliberately prepared. Official league tracking is not merely a workaround for missing live ranks: it is the admission boundary that lets LetLetMe know the cohort, schedule collection, reuse source evidence, audit completeness, preserve weekly evidence, and refuse workloads the current hardware cannot support.

Reliable official live values can simplify local scoring without removing tracked league preparation. LetLetMe may consume official points, ranks, and bonus as authoritative inputs, while retaining the prepared roster, picks, weekly results, storage, auditing, analysis, and reports. A league with more than 500 entries is rejected when full-league tracking is first created; LetLetMe does not attempt to infer whether it is global, system-generated, or user-created. Once admitted, the league remains tracked until the season ends even if its roster later grows beyond 500, and admission is evaluated again for the next season.

A **custom competition** is also deliberately prepared. The organizer defines it before it can run; LetLetMe stores its identity, membership, rules, gameweek window, and format, prepares the required picks, then calculates and preserves its own standings or bracket. An official league of any size may supply participants, but the selected custom-tournament roster itself may contain at most 500 entries. A large source must use a bounded selection/import method rather than loading its complete membership.

### Review: close provisional live results against official truth

The current My Team and My Tournament surfaces show completed gameweeks using official settled results. They also add season history and comparative intelligence such as captain contribution, bench points, hits, transfers, chips, rank movement, mini-league metric ranks, leaders, averages, risers, and fallers.

This is not merely a fallback for live-calculation gaps. It is the canonical post-gameweek record and the place where users understand how they and their competition performed.

### Data: the original evidence area becomes Explore

The five current tools—Gameweek, Fixtures, Market, League Trends, and Player Stats—support preparation, explanation, and deeper inspection. They are useful, but `Data` is too technical and too narrow once source-backed reporting, video, social media, forums, and named creator views are included. The public category should become **Explore**, while the underlying `/explore/*` routes remain stable initially. The Explore label opens a lightweight `/data` Overview; its compact submenu keeps Gameweek, Fixtures, Market, Trends, Players, and Briefing.

```text
Between gameweeks          During matches             After finalization
Explore / evidence   →     Live results        →      My FPL / settled truth
                              │     │
          tracked official league    prepared custom competition
           official final results    LetLetMe tournament rules
```

## 3. Current website capabilities

The following is the corrected high-level website picture, grouped by the product job rather than by individual routes.

| Category | Current capability | Correct strategic treatment |
| --- | --- | --- |
| Live | Reliable real-time team and prepared-competition results, live squads, point breakdowns, player contributions, matches, BPS/bonus, standings/rank movement, revision-aware refresh, and retained/degraded states | Primary product surface. Keep Live Points, prepared Competition Live, and Live Matches; do not add arbitrary unprepared official-league lookup. |
| Competitions | Prepared official-league tracking machinery with roster synchronization and weekly collection, plus custom membership, gameweek windows, points races, single/double knockouts, live standings, completed results, and selection metrics; additional race models exist in the backend | Present publicly as **Competitions** with tracked official leagues and custom competitions. Share entry/league evidence across every competition sourced from the same league while preserving each competition's own result and audit. |
| Review | My Team and My Tournament across gameweeks/seasons: official points, ranks, value, squads, transfers, hits, chips, captaincy, bench, standings, metric ranks, leader/average gaps, form, risers, and fallers | Core trust and retention surface. Use official finalized results as authority and differentiate through explanation and comparative competition intelligence. |
| Data | Gameweek Stats, Fixtures, Market, League Trends, and Player Stats, including player comparison, FDR/BGW/DGW, price/ownership/transfer movement, EO/exposure, official expected metrics, and verified real-match evidence | Present this publicly as **Explore**. Improve selectively when it connects to My FPL, a field, a competition, Live, or settled review; avoid a generic feature race. |
| Foundation | Official FPL event/player/entry/league/live/market/history data, independent real-match provider data, prepared league/tournament picks, persistence, caching, queues, lineage, and GraphQL read models | Preserve the shared scheduled pipeline and the separate entry-, league-, and tournament-level records. Make the source, roster behaviour, rules, provisional/final status, provenance, coverage, and freshness visible. |

### Target public information architecture

The public navigation is:

> **Live · Briefing · My FPL · Competitions · Explore**

| Public section | Definition and contents | Boundary | Short user-facing description |
| --- | --- | --- | --- |
| **Live** | Live Points, prepared Competition Live for tracked official leagues and custom formats, Live Matches, bonus, rank/standing movement, freshness, and selected change explanations | Owns fast current-gameweek presentation and compact past-gameweek score lookup; it does not create or prepare competitions | **Follow every point, rank and competition change as it happens.** |
| **Briefing** | Week, News, Views, and Features compiled from attributed real-world public sources | Owns one globally edited publication for all users; it does not personalize, ask users to follow sources, or issue LetLetMe recommendations | **Catch up on the real-world information shaping this gameweek.** |
| **My FPL** | The manager's linked team, personal homepage, official leagues, remembered/followed context, completed-gameweek review, and season history | Owns persistent personal context and settled personal interpretation; it never performs official FPL actions | **Your team, your season and everything LetLetMe remembers for you.** |
| **Competitions** | Prepare, manage, and preserve tracked official leagues and LetLetMe custom competitions, including roster/membership, setup, rules where applicable, groups, races, knockouts, auditing, and history | Whole-league Live and reports require prior preparation; arbitrary public league lookup does not begin in Live | **Track your leagues and run competitions your way.** |
| **Explore** | Gameweek, Fixtures, Market, Trends, Players, and comparison across quantitative evidence | Helps the manager inspect evidence; it does not issue forecasts, recommendations, or official actions | **See what is changing across players, fixtures and the market.** |

`Me` is too vague, singular `Tournament` incorrectly suggests one event and preserves the old mixed model, and `Data` is too technical for a gaming product and too narrow for public-source information. `Research` was considered and rejected because it sounds effortful and is unlikely to invite a common gaming user to click. `Explore` is lighter, user-driven, and broad without implying an algorithmic recommendation feed.

Use singular **competition** for an individual object or action (`Create a competition`, `Competition rules`) and plural **Competitions** for the navigation category.

### Public-source information and Briefing

Briefing is the fifth top-level section and the canonical browse home for reporting, YouTube, social media, publishers, and named creator views. Its submenu is **Week · News · Views · Features**. Relevant source cards may later appear contextually elsewhere, but Briefing V1 itself remains one globally edited publication with no personal follow/mute state.

Organize public-source material by user relevance, player/team/topic, evidence class, source, and publication time—not primarily by platform. Keep these evidence classes visibly separate:

- Official or club fact.
- Reporter or publisher information.
- Observed manager behaviour such as Top 10k selection.
- Attributed creator/KOL opinion.

Preserve named attribution, time, direct links, disagreement, and rights constraints. Do not convert mention volume into `community consensus`, a sentiment score, or a LetLetMe recommendation.

Briefing is organized as topic boards around players, clubs, gameweeks, or recurring questions, with evidence classes and a short timeline—not as reverse chronology by platform. Its foundation is an allowlisted source registry with acquisition method, rights basis, entity links, deduplication, correction/removal state, and language provenance. LetLetMe does not assume that X posts, YouTube transcripts, paywalled journalism, or any other source may be scraped, stored, summarized, or redistributed without source-specific verification.

### Retention model: accumulated value, not longer sessions

Stickiness does not mean forcing users to travel through every section or maximizing time on site. It means becoming their default place to return because LetLetMe has accumulated context that generic live tables, official FPL, X, YouTube, and standalone data tools do not combine.

- **Identity:** remember the manager, team, official leagues, and custom competitions after the first useful visit.
- **Accumulated context:** preserve followed rivals, players, competitions, sources, comparisons, history, and relevant preferences so later visits start ahead of the first one.
- **Relevant change:** answer `What changed that matters to me since I last checked?` rather than reopening on a generic dashboard.
- **Social commitment:** invitations, rivals, custom-competition progress, and shareable result objects give groups recurring reasons to return.
- **Timely return triggers:** use opt-in notifications only for material deadline, followed-player, competition, live, or settlement changes.
- **Trust and closure:** expose freshness and provenance, preserve provisional live states, and reconcile them to settled results.

The concise internal model is:

> **Live attracts users. My FPL retains them. Competitions bring their friends. Explore earns their trust.**

A sticky user is not defined by a long visit. A sticky user returns across gameweeks because LetLetMe recognizes them, remembers what matters, shows relevant change immediately, and preserves the season's personal and social history.

The current web creation flow visibly exposes official Classic import, points-race grouping, and single/double elimination. Backend models also include battle-race and head-to-head concepts that are not all exposed through the same creation UI. Backend capability should not be counted as a complete user-facing format until creation, explanation, live display, finalization, and management all work as one journey.

### Player State boundary

Deterministic Player State belongs in the product only as an optional transparent **Evidence Summary**, not as a headline score.

It must expose its rules, reasons, data coverage, sample limitations, and withheld states. Its overall directional headline remains withheld whenever the release evidence has not demonstrated reliable ordering. It must not quietly become a transfer recommendation or an opaque AI score. Per-metric difference emphasis remains useful for valid like-for-like player comparisons, but no aggregate winner or player score is allowed.

## 4. Market position

Mature FPL products occupy several established positions:

| Product/category | Established strength | Implication for LetLetMe |
| --- | --- | --- |
| Official FPL | Official team operation plus increasingly live ranks, mini-leagues/cups, projected bonus, richer squad views, and price-change prediction | Treat complete official values as authoritative upstream facts. Official improvement changes LetLetMe's data-source strategy; it does not automatically remove the live-first product surface. |
| LiveFPL | Fast live rank, EO, safety scores, rank-neighbour, elite, and Top 10k context | Validates that a focused third-party live companion remains useful beside official FPL. LetLetMe differentiates through reliable team/league views, custom competitions, remembered personal context, explanation, and provenance. |
| FPL Team / FPL Review | Multi-gameweek planning, drafts, forecasts, expected minutes, solvers, and optimized transfer paths | A mature prediction-led category that does not match LetLetMe's trust position or resource allocation. |
| Fantasy Football Hub / Fix | Predictions, AI recommendations, planners, live rank, price tools, advanced data, expert/team reveals, and content | Do not compete on forecast authority or an all-in-one advisory bundle. |
| Fantasy Football Scout | Deep comparison/statistics, heatmaps, injuries, press/team news, predicted lineups, set pieces, editorial content, and community | LetLetMe needs better source-backed football context, but should aggregate/license/attribute rather than become a newsroom. |
| LetLetMe | Reliable real-time team and tracked-official-league viewing, persistent personal context, structured official and verified evidence, descriptive exposure, and a broad custom-competition engine | Own a live-first but season-persistent evidence and resource-bounded competition position. |

LetLetMe should not pursue feature parity across all of these categories. Its defensible position is:

> **Reliable live teams and prepared league competitions + neutral evidence + custom formats.**

## 5. Where limited resources should go

No user-usage telemetry was available for this decision, so the ranking below is a product-strategy judgment based on recurring gameweek use, differentiation, official substitution risk, adjacency to existing capabilities, and operating cost. It should be validated against real activation and return behaviour rather than treated as measured demand.

| Resource position | Product area | Why | Direction |
| --- | --- | --- | --- |
| Protect first | Live reliability and matchday experience | This is the product heartbeat, highest-frequency use occasion, homepage promise, and foundation of competition engagement | Protect freshness, correctness, graceful degradation, point explanations, and scan speed across Live Points and prepared competitions. Reduce unnecessary local official-score calculation when official facts are trustworthy. |
| Protect the boundary | Tracked official leagues | They bound whole-league compute and storage while enabling consistent weekly analysis, auditing, and reports | Require explicit setup, admit a league only when it has at most 500 entries, reuse its source evidence across every dependent report and tournament, and preserve coverage/failure states. Maintain an admitted league through the season even if it later grows beyond 500. Do not build arbitrary public whole-league lookup. |
| Differentiate first | Custom competitions | Official FPL cannot replace custom membership, windows, groups, races, battles, and knockouts | Concentrate on easy creation/import, invitations, clear rules, reliable live standings, and post-gameweek stories. Do not build endless formats before existing formats show sustained participation. |
| Deepen next | Finalized team and competition review | It closes the provisional-to-official trust loop and turns collected history into lower-cost recurring value | Focus on comparative intelligence: captain, bench, hit, chip, transfer, value, autosub, rank movement, leader/average gaps, and season path. Avoid merely copying official history. |
| Support selectively | Explore and its evidence tools | They explain the other three areas but compete in a crowded generic-tools and content market | Improve them when they add My FPL, field, competition, Live, or settled-review context. Keep direct pages for power users, add Briefing, and reuse the same cards contextually. |
| Cross-cutting | LetLetMe Lens | It can reduce navigation and make the core easier to understand | Build it as a composition/explanation layer over Live, My FPL, Competitions, and Explore—not as a fifth standalone product or advisory bot. |
| Stop investing | Duplicated official scoring calculation inside tracked leagues | When official live totals are complete, recalculating the same official result spends resources and creates disagreement risk | Consume validated official totals and bonus where reliable, while retaining league admission, roster/pick preparation, persistence, auditing, analysis, reports, and the minimum fallback needed for incomplete contracts. |

**Custom competitions are strategically valuable, but that does not mean every additional format deserves investment.** The real product risk is activation: a format has value only when a group can create it, bring participants in, understand the rules, return during matches, and reach a satisfying completed result. Resources should favour that complete social loop over format count.

## 6. Official league tracking and custom tournaments under one resource boundary

Six related concerns must remain separate:

1. **The user job:** reliably follow a team or a prepared group in real time.
2. **Source admission:** decide which complete official leagues LetLetMe can afford to prepare, collect, store, audit, and report.
3. **Roster behaviour:** a tracked official league follows its upstream membership between gameweeks; a custom tournament uses its selected membership unless its organizer changes it.
4. **Rules and final result:** official FPL controls official league standings and finalized entry totals; LetLetMe controls custom-tournament rules and derived outcomes.
5. **Evidence reuse:** collect official entry and league facts once, then reuse them across every report and tournament that needs them.
6. **Experience:** add comparison, explanation, history, freshness, and competition context rather than reproduce an official table without additional value.

The copied Classic model originally solved missing official live data, but it also performs a second job that remains necessary: it establishes a known cohort before LetLetMe commits full-league resources. Without that boundary, arbitrary public league IDs could trigger hundreds of entry reads, live calculations, weekly snapshots, database rows, audit retries, and reports that may never be used again.

Therefore tracked official league preparation remains. Official improvements change **where points and ranks come from**, not whether LetLetMe controls admission and collects durable league evidence.

### Correct target model

| | Tracked official league | LetLetMe custom tournament |
| --- | --- | --- |
| User intent | Track one official league consistently in LetLetMe | Play a defined alternative format |
| Entry | Explicitly start tracking from an official URL/ID | Create the tournament, select or import participants, and define rules/window |
| Admission | One source count check at creation; accept 500 or fewer and reject 501 or more | Accept a selected tournament roster of 500 or fewer, regardless of the source league's total size |
| Setup requirement | Required before full league Live, collection, and reports | Required before the competition can calculate reliably |
| Roster behaviour | Synchronize official membership between gameweeks and freeze it during an active gameweek; preserve per-gameweek evidence | Use the selected LetLetMe membership unless the organizer changes it under the tournament rules |
| Final result | Official points, ranks, bonus, squad state, and corrections | Official entry facts as inputs; LetLetMe rules determine standings, groups, matchups, or brackets |
| Persistence | Roster checkpoints, picks, results, transfers, source/freshness evidence, derived analysis, audit state, and history | Rules, membership, picks/snapshots, results, derived analysis, audit state, and history |
| Compute shape | Schedule work for the admitted cohort; share entry- and league-level evidence with all dependent tournaments | Schedule tournament-specific calculation for the selected cohort while reusing official facts |
| Season rule | Once admitted, maintain the league through the season even if membership later exceeds 500; re-evaluate admission next season | The tournament roster must remain within 500 throughout its supported lifecycle |
| Creation eligibility | Any user who can use the normal creation flow; no special official-league-admin role or additional quota | Any user who can use the normal creation flow |

Both live under **Competitions**, but the source, roster behaviour, and rules must be understandable. A tracked league is not a custom format. One official league may source many custom tournaments, and those tournaments are intentionally separate objects.

The persisted model must make that distinction explicit. Each competition has a season, a competition kind, a stable LetLetMe organizer, and an ID that remains canonical even when another group uses the same display name. A first-class official source is unique by season, league type, and league ID; it owns admission, roster checkpoints, official evidence, coverage, and source audit. Any number of distinct competition objects may reference it without duplicating that source work.

A fixed snapshot or selected subset copied from an official league is a custom tournament. The tracked-league command always means synchronized official membership and must fail visibly when that service is unavailable rather than silently create a snapshot.

### Controlled official league admission

- Make one inexpensive official request to determine the source league's entry count before full-league tracking begins.
- Admit the league when it has 500 entries or fewer; reject it when it has 501 or more at creation.
- Apply the size rule directly rather than trying to classify the league as global, system-generated, or user-created.
- Once admitted, maintain it until the season ends even if it later grows beyond 500; evaluate the next season independently.
- Allow any user with access to the normal creation flow to start tracking; do not require official league administration or an additional quota for now.
- Reuse entry- and league-level source evidence for repeated tracking requests and every tournament based on that league. Do not deduplicate or block distinct tournament objects.
- Complete roster/pick preparation before promising full Live and weekly reports. A league first submitted during an active gameweek may need to become fully available from the next safe preparation boundary.
- Keep setup, pause, partial coverage, retry, and failure states visible.

This means **an arbitrary official league URL must not trigger a public whole-league live calculation**. The user either opens an already tracked league, deliberately starts bounded setup, or continues to the official FPL site.

### What reliable official live data changes

A separate local scoring calculation can only match the official result or disagree with it. Once the official contract proves complete and operationally reliable, a tracked league should consume official totals, ranks, projected/final bonus, and official squad state rather than recalculate the same official outcome.

Tracked league service must still retain:

- Resource admission and shared source-evidence reuse.
- Roster synchronization and per-gameweek cohort evidence.
- Scheduled pick, transfer, live/final result, and source-freshness collection.
- Completeness audits, bounded retries, and recovery.
- Historical reports, field metrics, comparison, and provisional-to-final reconciliation.
- The minimum fallback required when an official fact needed by the product is missing or delayed.

Custom competitions retain LetLetMe calculation because their rules and result do not exist in official FPL.

The target shapes are:

```text
Official league URL/ID
    → creation-time entry-count gate (maximum 500) → tracked official league
    → synchronized roster + shared weekly evidence + official live/final facts
    → Live Competition → settled league report and history

Custom competition definition
    → selected membership (maximum 500) + rules + prepared picks
    → shared official entry facts + LetLetMe rules engine
    → Live Competition → settled custom result and history

One official league may supply members and shared evidence to many custom tournaments.
A source league above 500 may seed a custom tournament only through a bounded import
that prepares no more than the selected 500 entries; do not crawl the whole source.
```

### Retire after proof

- Independent official-score calculation where official entry totals are complete.
- Independent provisional bonus allocation where official projected bonus is complete.
- Duplicate official entry fetches and league-evidence rows for the same source scope.
- Any live sub-view that duplicates an official table without adding personal context, comparison, explanation, history, or another meaningful workflow advantage.

### Keep

- The Live menu as the first product category and primary matchday destination.
- Reliable real-time Live Points, player contributions, and clear data state.
- Tracked official leagues as the controlled path to full league Live, weekly analysis, auditing, and reports.
- Prepared custom-competition standings, matchups, movement, filtering, and competition context.
- A Classic-league URL as a tracked-league source and, through a separate explicit action, an optional participant source for any number of custom competitions.
- Preloaded membership/picks, schema validation, caching, bounded retries, freshness, lineage, and history.
- Custom groups, points races, battles, and knockout logic.
- The minimum fallback required when the official contract is incomplete.

Replacing a scoring implementation is an infrastructure simplification. It must not be described as retiring either LetLetMe's live-first identity or tracked leagues' resource-control and historical-data roles.

### First-live-gameweek verification gate

The official UI announcement is not yet proof of a stable public API contract. During the first live gameweek verify:

1. Projected bonus is available and revises consistently with the official UI.
2. Per-entry live totals include transfer hits, chips, captain fallback, and the official post-substitution squad state.
3. Classic standings and ranks update live for the prepared roster.
4. Entry-count reporting, pagination, cadence, rate limits, failures, and finalization are operationally acceptable within the 500-entry boundary.
5. Tracked-league collection and both source/tournament audit layers remain complete when official values replace local official-score calculation.

The initial tracked-league product promise is for official Classic leagues. Official H2H tracking follows later, after the first Classic experience and a small number of H2H leagues have been exercised and verified end to end.

## 7. Finalized Review is a core product layer

Live and Review must have different truth contracts:

- **Live is provisional:** optimized for speed, revision-aware refresh, explanation, and clear freshness. Bonus, official squad state, or upstream corrections may still move.
- **Review is settled:** once official FPL finalizes the gameweek, My Team and tracked official leagues use the official finalized total as the non-negotiable record; custom competitions recompute and publish their LetLetMe standings, matchups, or brackets from those settled official inputs.

This distinction is a strength, not an admission that Live is unreliable. A responsible live product tells users what is provisional and then closes the record against the authority.

The durable value of Review is not the copied final score. It is the analysis around official outcomes and LetLetMe's finalized custom result:

- How the manager's rank and competition place changed.
- Which captain, bench, hit, chip, transfer, or automatic-substitution outcomes mattered.
- How the manager ranks inside the mini-league on value, transfers, costs, bench points, and autosub points.
- Who led the gameweek, who rose or fell, and how the user compares with the leader and field average.
- How those patterns evolved across gameweeks and seasons.

The current `Me` routes contain this capability, but the decided public category is **My FPL**. Review is one major state inside My FPL rather than the navigation label for the entire personal area. My FPL must also carry season-scoped identity, a phase-aware Overview, bounded saved context, personal league and competition summaries, and relevant change between visits; it should not be treated as a secondary copy of official pages. Full competition-wide tables and reports belong to Competitions, not to a permanent `My Tournament` page.

## 8. Explore should make evidence approachable, not become a feed

The five current Data tools form the quantitative foundation of Explore:

- **Gameweek:** official round results, dream team, high scorers, captaincy, transfers, and chips.
- **Fixtures:** FDR windows, blank/double gameweeks, team runs, and personal squad overlays.
- **Market:** price, ownership, transfer, availability, and player-pool changes.
- **League Trends:** ownership, EO, captaincy, transfers, template, and personal exposure across defined fields.
- **Player Stats:** comparison, availability, price history, recent gameweeks, fixtures, official FPL metrics, percentiles, and separate verified match evidence.

These tools should remain directly available to power users, but their cards and calculations should increasingly appear inside the contexts that give them meaning: Live explanations, My FPL, tracked-league or custom-competition analysis, player comparison, cohort context, and the Lens.

Add **Briefing** as the public-source area inside Explore. Briefing should organize source-backed reporting, video, social media, forums, publishers, and KOL views into topic boards around players, teams, gameweeks, and recurring questions. It is not a reverse-chronological platform feed, a newsroom, or a consensus engine.

Add a lightweight **Explore Overview** at `/data`. It is a router over the detailed tools, not a duplicate homepage: current gameweek phase, material official/fixture/market changes, saved-player context, active cohorts, recent comparisons, new Briefing topics, and deterministic search across players, clubs, gameweeks, cohorts, topics, and sources. The search is ordinary website navigation and filtering, not an assistant or question-and-answer interface.

Generic statistics or generic content alone are not a strong use of limited resources because mature FPL products already compete deeply on data breadth, heatmaps, projections, planners, editorial content, and social reach. LetLetMe should prefer **contextual depth** over raw breadth: how a fact or attributed view relates to this team, field, or competition.

### Forecasts, optimization, and recommendations remain outside the core

LetLetMe does not need to prove that every FPL projection model is mathematically inaccurate.

The product decision rests on more practical facts:

- Forecast accuracy is not accepted as unquestioned common knowledge across the FPL community.
- LetLetMe cannot independently verify and continuously defend the assumptions behind expected minutes, rotation, roles, injuries, and tactics.
- Building a competitive model would consume disproportionate resources.
- Precise forecasts would make LetLetMe look more certain and more advisory than intended.
- The market already contains mature specialist products in this category.

Therefore LetLetMe should not build its own xPts, generate xPts with an LLM, hide forecasts behind recommendations, or produce an optimized team.

A future external forecast source is relevant only if it earns product-owner trust, has an inspectable history, provides stable delivery, and grants written redistribution rights. Even then, it is optional, attributed third-party evidence—not `LetLetMe's answer`.

## 9. Website gaps excluding the information assistant

### A visible Live reliability contract

LetLetMe has revision-aware polling, minute-level upstream snapshots, retained last-known-good tournament rows, and post-match consolidation. The product still needs to turn that engineering into a clear user contract:

- Last successful update and current revision/freshness.
- Provisional, delayed, partially retained, settled, and unavailable states.
- Which values came directly from official data and which were calculated locally.
- Automatic recovery without silently mixing revisions or gameweeks.
- A defined target for matchday freshness and recovery.

This is more important than adding another generic data table because reliability is the core brand promise.

### Controlled official-league tracking setup

LetLetMe should keep the prepared tracking boundary rather than offer universal public league access. The product gap is making that controlled setup clear, economical, and recoverable:

- Start tracked-league setup from Competitions, a linked league row in My FPL, or an explicit Lens handoff—not from an anonymous live calculation.
- Make one source request to determine entry count, admit 500 or fewer at creation, and reject 501 or more with a clear official-FPL link.
- Maintain an admitted league through the rest of the season if it later grows beyond 500; re-evaluate it for the next season.
- Reuse official entry and league evidence for the same source. Multiple custom tournaments may reference that source and retain separate results and audits.
- Explain which gameweek will be fully covered, especially when setup begins after a deadline or during live play.
- Expose roster preparation, collection coverage, freshness, audit, retry, paused, and unavailable states in user language.
- Use reliable official live values to reduce duplicated score computation inside the admitted cohort.

This deliberately serves a prepared subset of leagues. That limitation is part of the current hardware and operating model, not a temporary UI omission to conceal.

### Complete custom-competition activation and participation

The engine is broader than the complete social product. A successful custom competition requires:

- Fast creation from an existing official league or a selected member list.
- Understandable format templates and rules.
- Invitations, participant onboarding, and membership clarity.
- A compelling live competition view.
- A completed-gameweek story and season history.
- Management/recovery states that do not require technical knowledge.

The main gap is not the number of supported formats. It is making the existing formats easy to start, join, follow, and finish.

The initial custom lifecycle is draft or enrollment, roster lock, preparation, active play, completion, and archive. Rules and membership may change before lock and remain fixed afterwards. Invitations may add a verified season-bound entry or let the matching user claim a seeded entry. Tracked leagues do not use invitations because official FPL remains their membership authority.

Competitions remain private by default: full Home, Live, roster, history, and management require organizer or participant access, while an invitation exposes only a sanitized preview. Archive is the normal removal action after shared results exist; ordinary organizer hard deletion is limited to competitions without published results.

A format is public only when its complete journey works: creation, rules explanation, preparation, Live, settlement, history, and management. Points-race completion comes before exposing additional backend enums or result tables as product features.

### Separate tracked leagues from custom tournaments without separating their evidence

Both belong in Competitions because both consume prepared cohort resources, but their source, roster behaviour, and rules must be explicit:

- **Tracked official league:** a prepared service keyed to an upstream league. It synchronizes membership between gameweeks and uses the official finalized record; LetLetMe owns scheduled collection, source audit, analysis, and presentation.
- **LetLetMe custom tournament:** a persistent object with a selected participant set, rules, preparation lifecycle, calculated result, tournament audit, and history.

The bridge between them is an explicit command—`Create a custom competition from these members`. One upstream league may be tracked once at the evidence level and separately seed any number of custom tournaments. Shared official facts do not make those tournaments the same object.

### Provisional-to-final reconciliation

When settled results differ from the last live view, show what changed and why: bonus finalization, the official post-substitution squad, captain fallback, corrections, hits, or another identified component. Then link the user directly into the settled Review view—official for My Team or a tracked league, and LetLetMe-finalized for a custom competition. The official finalized total always wins; audits must reconcile every detailed report to it.

This makes the relationship between Live and Review trustworthy instead of leaving users to notice unexplained differences.

### Deeper competition intelligence

The current finalized surfaces already provide captaincy, chips, rank movement, leaders, averages, and several season metrics. Extend this direction selectively around recurring competition questions:

- Where did I gain or lose relative to this field?
- Which captain, bench, hit, chip, or transfer outcomes separated teams?
- How did different cohorts behave?
- What changed from the previous gameweek?

Do not turn the answers into transfer advice.

### Top 10k and rank-tier evidence

Add template ownership, EO, captaincy, vice-captaincy, chips, formation, and week-to-week selection movement for a deterministic, stratified **Top 10k sample** and useful rank-band samples. This expands the existing League Trends foundation and gives My Team a relevant comparison beyond overall ownership. Overall FPL ownership must not be presented as Top-10k behaviour.

Every view must show:

- Gameweek and collection time.
- Cohort definition.
- The explicit `sample` label unless an exact collector later passes an operational resource and upstream-reliability gate.
- Target population, denominator, actual sample size, coverage, and method version.
- The settled rank reference used to select cohort membership.
- Change from a relevant prior snapshot.

Before a deadline, the new gameweek's frozen squads are not observable. Show the previous frozen template and current official transfer movement instead. Define cohort membership from the latest settled overall rank before the deadline, then capture the new frozen picks after the deadline. Do not label selection change as transfers unless actual transfer evidence was collected under the same cohort definition. Gameweek 1 and failed or partial capture use typed unavailable/partial states.

### Source-backed team, injury, and role context

Official availability does not fully explain minutes, injuries, press-conference updates, predicted lineups, set pieces, and role changes.

Show attributed facts and opinions side by side, preserve disagreement, and link to the source. Do not silently turn multiple opinions into a LetLetMe prediction.

### Saved following, change tracking, and shareable evidence

Start with a bounded set of durable personal objects: saved players, saved comparisons, followed rival entries, and pinned competitions. Official-league membership is discovered from the linked entry rather than followed manually. My FPL owns saved players and watchlist context; Explore owns followed or muted Briefing topics, publishers, and creators. Explore Overview may compose both without duplicating their persistence models.

Store a typed last-seen baseline only after a successful view, then show material changes since that baseline. Do not turn background fetches into seen state and do not invent a change history for a first visit.

This is a watchlist and evidence-change surface, not a transfer plan.

Create source-labelled, timestamped, accessible comparison, cohort, tracked-league, and custom-competition cards with stable deep links.

These are useful to users in group chats and provide an organic distribution mechanism without turning LetLetMe into a social network.

### Consistent provenance, freshness, and coverage

Every material figure should identify its evidence class, source, update time, sample/coverage, and derivation when applicable.

### Secondary opportunities

- User-controlled alerts for new deadline, availability, price, or followed-player changes.
- Broader field benchmarking against Top 10k, rank bands, nearby ranks, selected rivals, and custom competition fields.
- Richer tactical/event visualizations only where data is reliable, permitted, and explanatory.

### Intentional non-goals, not missing features

- Official team operation.
- Home-grown projections or solver.
- Official price prediction.
- Exact official-live replicas after API proof.
- Arbitrary public whole-league Live or enrichment without tracked-league admission.
- A newsroom, paywall scraping, or a generic community forum.
- A transfer-planning or multi-gameweek decision workspace, which remains a separate future discussion. This does not justify the current review pages' multi-tab gameweek UI when only one gameweek is visible at a time.

## 10. LetLetMe information assistant

### Product identity

Working name: **LetLetMe Lens**.

`Ask LetLetMe` may be an entry action, but the product should not present itself as a bot.

LetLetMe Lens is an adaptive information interface that understands the user's intent, retrieves verified LetLetMe data and permitted attributed sources, and composes a visual board of reusable product cards.

Conversation is one possible input. The output is a scoped, inspectable evidence board—not a chatbot transcript.

The Lens should not become a fifth top-level product competing with Live, My FPL, Competitions, and Explore. It should be a persistent capability inside those sections and a shortcut across them.

On matchdays, the Lens should begin inside the live experience: what changed in the user's team, which players caused it, how bonus and the current official squad state affect the total, and how tracked-league ranks or custom-competition positions moved. Outside live play, it can shift toward gameweek research, comparisons, field context, and attributed public discussion.

Its product priority follows the core: **Live explanation first, My FPL continuity and settled review second, prepared-competition understanding third, and Explore/Briefing compression around them.**

The tracked-league/custom-tournament distinction and preparation boundary must be part of the Lens's tool semantics. `Show official league 123` should resolve existing tracked-league evidence and compose its current board. If the league is not tracked, the Lens should explain that bounded setup is required and hand off to Competitions or official FPL; it must not silently trigger whole-league collection or calculation. `Show our knockout competition` should resolve an existing prepared custom competition, with the same prohibition on silent persistent creation.

AI is internal machinery for:

- Understanding intent and scope.
- Resolving players, teams, gameweeks, leagues, and competitions.
- Selecting and calling the correct product and evidence tools.
- Grouping attributed public sources.
- Summarizing without losing provenance.
- Composing the board from existing product surfaces.

The AI is not a manager persona or authority.

### Core verbs

**Follow, find, compare, explain, brief, filter, save, share, and hand off.**

### Board types

| Board | User job | What it assembles | Boundary |
| --- | --- | --- | --- |
| Live | What changed right now in my team and prepared competitions? | Net points, player contributions, projected/final bonus, captaincy, hits/chips, current official squad state, live rank/standing movement, custom matchups, freshness, and degraded-data notices | Use authoritative inputs where available; distinguish provisional from final and never hide staleness |
| Tracked Official League | Show this prepared official league now | Authoritative standings, points and movement available from the official contract, plus stored entry comparison, field analysis, collection coverage, and explanation | Resolve existing tracked-league evidence; label preparation, audit, freshness, and coverage. Never start an arbitrary whole-league job inside the board |
| Review | Why did my gameweek, tracked-league rank, or custom-competition position finish this way? | Settled points, reconciliation from the last live state, custom result where relevant, captain/bench/hit/chip/transfer outcomes, rank movement, field averages, metric ranks, and season path | Official finalized facts control My Team and tracked-league outcomes plus custom inputs; LetLetMe rules control the custom result; distinguish observed contribution from causal or advisory claims |
| Brief | Catch me up on this gameweek | Official changes, followed players, cohort movement, My FPL intersections, competition context, and attributed discussion | Lead with what changed; no recommendation summary |
| Find | Show the relevant information without making me navigate | Existing LetLetMe cards scoped to a player, gameweek, team, league, or competition | Return modules and deep links, not a prose dump |
| Compare | Compare two or more players | Availability, role/minutes evidence, FPL and verified match metrics, fixtures, market movement, cohort ownership, and sourced context under the same scope | Show differences and trade-offs; never declare a winner |
| Explain | Why did this value or state change? | Before/after values, official facts, LetLetMe derivations, scoring components, freshness, and caveats | Separate observed causes from plausible context |
| Field | What does my field look like? | Top 10k/rank-band/rival ownership, EO, captaincy, chips, template, and personal exposure | Popularity is not correctness |
| Custom Competition | What matters in this prepared competition? | Format, matchup, standings, gaps, form, official entry inputs, and selection differences | Resolve an existing competition and its preparation state; explain competition state without advising team actions |
| Briefing | What are selected public sources saying? | Named posts, video metadata/permissioned transcripts, publisher links, repeated themes, and disagreement | Supporting Explore layer; attribute every claim and never convert mentions into consensus advice |
| Handoff | Let me inspect or act | Deep links to LetLetMe, the original public source, or official FPL | LetLetMe never performs official actions |

## 11. Evidence model

The assistant and website must keep unlike evidence visibly separated.

| Evidence label | Meaning | Product treatment |
| --- | --- | --- |
| Official FPL fact | What the authoritative game currently reports | Present as authority with freshness |
| LetLetMe calculation | A transparent derivation from identified inputs | Show calculation, rules, or reasons |
| Verified real-match evidence | An independent provider's description of on-pitch events | Keep visibly separate from official FPL facts |
| Observed manager behaviour | What a defined cohort actually selected | State cohort, time, and exact/sample denominator; never endorse |
| Attributed public discussion | What named creators, reporters, or publishers said | Preserve attribution, links, time, disagreement, and rights basis |
| Forecast or recommendation | A model/person's judgment under assumptions | Excluded from the LetLetMe voice by default |

Acceptable language:

- `In the disclosed Top 10k sample, ownership increased from 22% to 31%.`
- `Eight of fifteen selected sources mentioned this player.`
- `Frequently discussed considerations were fixtures, penalties, and minutes.`
- `Creator A suggested the player; Creator B raised a minutes concern.`

Unacceptable LetLetMe conclusions:

- `Buy him.`
- `Avoid him.`
- `Essential.`
- `Best captain.`
- `The community recommends him.`

## 12. Modern experience model

During live play, the Lens should open with a contextual **Live Brief** for the user's team, tracked official leagues, or custom competitions. Outside live play, it should open with a useful **Gameweek Brief**. Neither state should be an empty chat screen.

A user request becomes the board title. Editable scope chips might include:

- `GW3`
- `Top 10k`
- `My Team`
- `Since yesterday`
- `Official data only`
- `Show different views`
- `Only videos`

Cards arrive by evidence type. Follow-up actions reconfigure the current board rather than building a long speech-bubble transcript.

Every material card should expose:

- Evidence type.
- Gameweek/date/time scope.
- Exact versus sampled coverage.
- Source and freshness.
- Calculation/methodology where derived.
- Relevant caveats or missing coverage.
- Save, share, inspect, and deep-link actions.

Avoid:

- A mascot or manager persona.
- Alternating chat bubbles.
- Typing theatre.
- Reverse-chronological feeds as the primary structure.
- Generic prose dumps.
- Sentiment meters.
- Creator rankings.
- `AI confidence` badges.
- Action labels such as `Buy`, `Avoid`, or `Best Pick`.

## 13. Homepage and brand direction

### The current hero teaches a matchday-only product

The current hero hierarchy is visually strong but strategically too narrow:

- Eyebrow: `Matchday centre · FPL live`
- Headline: `Every point. Every rival. Live.`
- Both prominent actions lead to live results.
- The supporting sentence enumerates live scoring, player form, price moves, and private tournaments.

This combination tells a new visitor that LetLetMe is principally a matchday scoreboard. The sections below the hero cannot reliably correct that first interpretation.

The hero was inspected in the current local application on 10 August 2026. At a 1280 × 720 viewport, the hero occupied approximately 509 px below the navbar; the headline used two lines and the description used two. At 390 × 844, the hero occupied approximately 801 px below a 66 px navbar—effectively the full first mobile screen; the headline used three lines and the description used four.

Therefore the copy budget is:

- One short eyebrow on one line.
- A five-to-seven-word headline using two desktop lines and no more than three mobile lines.
- One supporting sentence of roughly 16–20 words, using two desktop lines and no more than four mobile lines.
- One primary and one secondary action.
- No second explanatory paragraph and no hero feature inventory.

### Slogan and hero copy

The brand slogan and hero headline are:

> **The whole gameweek. Your call.**

Use the existing green marker treatment on `Your call.` This communicates complete gameweek coverage and the manager's authority without presenting LetLetMe as an adviser.

- **Eyebrow:** `FPL · Before, during, after`
- **Headline:** `The whole gameweek. <marker>Your call.</marker>`
- **Description:** `Reliable live results and evidence in context—before the deadline, through every match and after the final points.`
- **Primary action:** `Find my team` for a guest; `Open My FPL` for a linked manager.
- **Secondary action:** phase-aware where practical: `Follow live`, `Explore this gameweek`, or `Review the gameweek`.

The slogan should also replace unrelated product taglines in persistent brand surfaces so the homepage, footer, and later campaign copy communicate one promise.

### Logo assessment

The current mark is a three-step staircase ending in a pink dot, paired with a condensed `LetLetMe` wordmark whose LLM initials use electric green. At its rendered 36 × 36 navigation size it is compact, recognizable, high-contrast, and visually appropriate for an energetic live-sports product. The wordmark and plum/electric/pink palette should be retained.

Its semantic fit is only partial:

- The staircase reads primarily as an upward chart or rank improvement.
- `Rank going up` suggests optimization or an outcome LetLetMe cannot promise.
- The hidden two-L/LLM construction is unlikely to be understood without explanation.
- The pink dot is not immediately recognizable as a football.
- The mark represents live movement better than it represents persistent context, evidence, or a whole gameweek.

The logo is usable and is not the current priority to replace. Do not make the brand depend on its hidden `LLM climbing` explanation. If the brand mark is refreshed, preserve the wordmark, palette, compact sporting character, and sense of movement while exploring a neutral live/score/comparison signal rather than an exclusively upward path.

## 14. Full product model

```text
TEAM PATH
Team ID → official live facts → Live Points
        → My FPL settled review + explanation + history

TRACKED-OFFICIAL-LEAGUE PATH — persistent and prepared before whole-league service
Official league URL/ID → creation-time entry-count gate (maximum 500)
    → tracked league → synchronized roster + shared scheduled weekly evidence
    → official live/final facts → Live Competition
    → settled league report + source audit + history
    → maintain through the admitted season even if the roster later exceeds 500

CUSTOM PATH — persistent and prepared before calculation
Create competition → selected membership (maximum 500) + rules + gameweek window
    → shared official entry facts + LetLetMe custom rules engine
    → Live Competition
    → finalized custom standings/bracket + tournament audit + review + history

Explore supplies contextual quantitative and attributed evidence across all paths.
LetLetMe Lens finds, compares, and explains without bypassing preparation.
An official league of any size may seed one or many custom competitions through
a bounded import, but each custom roster remains capped at 500 and every tournament
keeps its own rules, results, history, and audit.
Official FPL remains the destination for official team actions.
```

In one sentence:

> **LetLetMe is the manager's persistent FPL context layer: reliable live results, remembered personal and competition context, and source-backed evidence across the whole gameweek—without making the decision for them.**

## 15. Success measures and open product decisions

No current values were available for the measures below. Instrumentation should validate whether the proposed core is producing real recurring behaviour before significant expansion.

| Product job | Decision-useful measures |
| --- | --- |
| Retention | Linked managers active across multiple consecutive gameweeks; percentage active in at least four of the previous six gameweeks; non-live-window return; relevant-change opens; remembered-context reuse |
| Live core | Current-gameweek load success; freshness target attainment; degraded/partial-result rate; recovery time; matchday returning users; Live Points and prepared-competition view depth |
| Tracked official leagues | Setup request-to-ready rate; entry-count rejection; shared-source reuse; time to ready; per-gameweek roster/pick/result completeness; audit recovery; compute/storage cost per tracked league; repeat Live and report use |
| Custom competitions | Creation-to-ready rate; invitation/participant activation; active entrants per competition; matchday return rate; gameweek completion; season completion; repeat creation |
| My FPL / settled review | Active-season binding completion; non-live return; relevant-change opens; Live-to-Review continuation; My Team depth; personal league and competition summary use; saved-context reuse; repeat review across gameweeks |
| Explore | Repeat use across Gameweek, Fixtures, Market, Trends, Players, and Briefing; contextual-evidence opens from My FPL/Live/Competitions; saved/shared evidence; source follows/mutes; direct-return behaviour |
| Lens | Successful board composition; follow-up/reconfiguration use; source/deep-link opens; save/share use; latency; unsupported or guardrail-breaking response rate |

These questions refine the product but do not change its definition:

- What freshness, availability, and recovery promise should the Live product make?
- Which minimum live facts must LetLetMe calculate or preserve as a fallback if official endpoints are partial or delayed?
- Which Live Points and tracked-league views make LetLetMe meaningfully better than opening the corresponding official pages?
- From which gameweek can a newly tracked league promise complete reporting, especially when setup begins after the deadline?
- What bounded participant-selection mechanism should a custom tournament use when its source league contains more than 500 entries?
- What exact end-to-end verification milestone should enable official H2H tracking after the initial Classic experience?
- Which custom competition format has enough activation and repeat use to justify deeper investment?
- Which additional rank bands and rival sets should be first-class cohorts?
- Which public creators, channels, and publishers belong in the initial source registry?
- Which sources require licences or explicit permission for summarization?
- Does a saved object represent a watchlist item, reusable board, change subscription, or all three?
- Which evidence objects can be publicly shared, and which personal data must remain private?
- Which neutral-language and attribution rules should be mechanically enforced?

## 16. Caveats and assumptions

- This is a direction and resource-allocation recommendation, not a measured product-performance report. No route usage, active-user, retention, custom-competition activation, or revenue telemetry was available.
- The repository verifies what is implemented or structurally supported; it does not prove that users understand, adopt, or value each capability.
- The analysis follows the requested assumption that in-progress changes will complete, while separately noting when backend structures are not yet a complete web journey.
- Official FPL's announced live experience has not yet been verified as a stable, complete public matchday API contract. The migration recommendation remains conditional on first-live-gameweek evidence.
- Custom competitions are the strongest differentiation thesis, but their resource priority should be reduced if creation-to-participation, matchday return, or completion data is weak.
- Market products, official features, APIs, pricing, and content-platform terms can change.

**Validation assessment: Ready to share as a product-direction document, with the adoption and API caveats above.**

## 17. Evidence and references

### LetLetMe repositories

Paths below are relative to the `letletme-web` repository root; `../` entries refer to sibling repositories in the LetLetMe workspace.

- Website information architecture: `components/layout/config.ts`
- Live-first homepage and tournament band: `app/[locale]/page.tsx`
- Current English/Chinese homepage copy: `messages/en.json`, `messages/zh-CN.json`
- Logo mark and wordmark: `components/layout/Logo.tsx`, `app/icon.svg`
- Live Points refresh and revision handling: `app/live/points/_hooks/useLivePoints.ts`, `lib/live-refresh.ts`
- Live tournament standings, filters, and retained partial rows: `app/live/tournaments/TournamentClient.tsx`
- Official-finalized My Team model: `app/me/team/_lib/team-stats-model.ts`
- Official-finalized My Tournament model: `app/me/tournament/_lib/tournament-stats-model.ts`
- Current Web-owned FPL binding and identity schema: `lib/db/schema/auth.ts`, `lib/fpl-entry-binding.ts`
- Current official-league singular tournament enrichment: `../letletme-graphql/src/domains/leagues/repository.ts`
- Current official entry and league result checkpoints: `../letletme_data/src/db/schemas/entry-event-results.schema.ts`, `../letletme_data/src/db/schemas/league-event-results.schema.ts`
- Player Stats: `app/data/player-stats/PlayerStatsClient.tsx`
- Transparent Player State: `app/data/player-stats/_components/PlayerStateProfile.tsx`
- League Trends and exposure: `app/data/selections/SelectionsClient.tsx`
- Classic-copy defaults: `app/tournament/create/_lib/tournament-form.ts`
- GraphQL tournament model: `../letletme-graphql/src/domains/tournaments/schema.ts`
- GraphQL live calculation: `../letletme-graphql/src/domains/entry-live/calc-service.ts`
- Official FPL client: `../letletme_data/src/clients/fpl.ts`
- Tournament roster synchronization: `../letletme_data/src/services/tournament-roster.service.ts`
- Tournament pre-deadline picks: `../letletme_data/src/services/tournament-event-picks.service.ts`
- Coordinated minute-level live snapshots and post-match consolidation: `../letletme_data/src/jobs/live.jobs.ts`
- Post-gameweek tournament result cascade: `../letletme_data/src/services/job-trigger.service.ts`
- Provisional bonus calculation: `../letletme_data/src/services/live-bonus.service.ts`
- Selection-stat aggregation: `../letletme_data/src/services/tournament-selection-stats.service.ts`

### Current market references

- [Official FPL 2026/27 changes](https://www.premierleague.com/en/news/4679873/all-you-need-to-know-about-changes-to-fpl-for-202627)
- [Official live ranks and projected bonus](https://www.premierleague.com/en/news/4680230/whats-new-in-202627-fantasy-league-rankings-change-in-real-time)
- [Official price-change predictor](https://www.premierleague.com/en/news/4680462)
- [LiveFPL](https://www.livefpl.net/)
- [FPL Team planner](https://fpl.team/plan/)
- [FPL Review documentation](https://docs.fplreview.com/getting-started/about-fplreview/)
- [Fantasy Football Hub](https://www.fantasyfootballhub.co.uk/welcome)
- [Fantasy Football Fix web features](https://www.fantasyfootballfix.com/web_features/)
- [Fantasy Football Scout comparison tool](https://www.fantasyfootballscout.co.uk/how-to-use-the-comparison-tool-in-the-members-area)
- [Fantasy Football Scout player statistics](https://www.fantasyfootballscout.co.uk/how-to-use-player-stats-and-profiles)

Market features, APIs, pricing, and platform terms can change. The official-live migration decision remains conditional on first-live-gameweek endpoint verification.
