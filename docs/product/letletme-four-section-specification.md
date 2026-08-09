# LetLetMe Four-Section Product Specification

- **Status:** Agreed companion product specification
- **Recorded:** 10 August 2026
- **Companion document:** [LetLetMe Product Conclusions](letletme-product-conclusions.md)
- **Shared implementation companion:** [LetLetMe Cross-Section — High-Level Implementation Plan](letletme-cross-section-implementation-plan.md)
- **Live implementation companion:** [LetLetMe Live Section — High-Level Implementation Plan](letletme-live-section-high-level-design.md)
- **My FPL implementation companion:** [LetLetMe My FPL Section — High-Level Implementation Plan](letletme-my-fpl-section-high-level-design.md)
- **Competitions implementation companion:** [LetLetMe Competitions Section — High-Level Implementation Plan](letletme-competitions-section-high-level-design.md)
- **Explore implementation companion:** [LetLetMe Explore Section — High-Level Implementation Plan](letletme-explore-section-high-level-design.md)
- **Scope:** The four public website sections: Live, My FPL, Competitions, and Explore
- **Assumption:** Current in-progress Web, GraphQL, and Data work is completed and available.

## 1. Purpose of this document

The product-conclusions document defines what LetLetMe is and where it should invest. This companion document turns that direction into a section-level website specification.

For each public section it defines:

- The section's purpose and boundary.
- The sub-pages or object views it should contain.
- The purpose and expected contents of each sub-page.
- What the current implementation already provides.
- What should be kept, renamed, extended, moved, built, or retired.
- The product gaps and the next work that would materially improve LetLetMe.

In this document, **sub-page** includes a navigable page, a persistent object-detail view, or an important state within one of those pages. It does not mean that every item must appear in the main dropdown. The public navigation should remain compact.

The four public sections remain:

> **Live · My FPL · Competitions · Explore**

The internal product model remains:

> **Live attracts users. My FPL retains them. Competitions bring their friends. Explore earns their trust.**

LetLetMe Lens is not a fifth section. It may find, compose, compare, brief, and explain information inside these four sections, but the underlying pages and objects remain the durable product.

### League and tournament definitions

- An **official league** is an upstream FPL source identified within a season by league type and league ID. Official FPL defines its membership, standings, ranks, and finalized entry results. LetLetMe may explicitly prepare it as a **tracked official league** for Live, weekly analysis, audit, and history. This is the concept previously called an official-league mirror.
- A **tournament** is a LetLetMe-created competition with its own selected membership, gameweek window, rules, format, derived results, lifecycle, history, and audit. It may import participants from an official league, but it remains a separate object.
- One official league may source many tournaments. Reuse official entry and league evidence across them; do not deduplicate or block distinct tournaments.

The operational records remain intentionally layered: official entry facts once per entry/gameweek, official league evidence once per league/gameweek/entry, and tournament outputs separately per tournament/gameweek or stage. Source audits and tournament-result audits answer different questions and both remain necessary.

## 2. Whole-site ownership model

| Section | Primary user job | Owns | Does not own |
| --- | --- | --- | --- |
| **Live** | Tell me what is happening now, or let me check a gameweek result quickly | Provisional team points, tracked-official-league and custom-competition movement, matches, bonus state, freshness, and compact finalized-gameweek lookup on the same simple result views | Competition setup, arbitrary unprepared league lookup, deep settled analysis, season history, forecasts, or official team actions |
| **My FPL** | Remember me and help me understand my season | Linked-team identity, personal home, official leagues, settled team and league review, followed context, saved objects, and relevant change between visits | Shared custom-competition administration or generic evidence browsing |
| **Competitions** | Track an admitted official league or let our group play a custom format | Tracked official leagues and custom competitions: source, roster behaviour, rules, setup, lifecycle, settled results, history, management, and a stable entry to the current live state | Arbitrary on-demand official-league viewing or official FPL team actions |
| **Explore** | Let me inspect the evidence and decide for myself | Gameweek, fixtures, market, trends, players, comparison, and attributed public-source Briefing | LetLetMe forecasts, optimized teams, transfer verdicts, or a generic social feed |

### Recommended compact navigation

The top-level labels should be the four sections. Their compact submenu can be:

- **Live:** Live Points, Live Competitions, Live Matches.
- **My FPL:** Overview, Team, Leagues.
- **Competitions:** My Competitions, Create.
- **Explore:** Gameweek, Fixtures, Market, Trends, Players, Briefing.

Following, saved objects, invitations, management, rules, results, history, comparisons, and individual object pages should be reached contextually. They do not all need permanent top-level menu entries.

The **Explore** top-level label opens Explore Overview. Overview does not need to consume another permanent desktop submenu slot; mobile navigation may expose it explicitly when the category label itself cannot be a reliable navigation target.

### Canonical-home rule

The same card may appear in more than one section, but every object needs one canonical home:

| Object or state | Canonical home | Contextual appearances |
| --- | --- | --- |
| Current team result | Live | My FPL overview, competition comparison |
| Settled personal result and season history | My FPL | Compact Live Points historical mode, Live reconciliation, Explore evidence links |
| Current tracked-official-league or custom-competition result | Live | Competition Home, My FPL personal summary |
| Settled personal official-league analysis | My FPL | Live handoff when the league is tracked |
| Tracked-official-league setup, roster, and shared history | Competitions | Live and My FPL summaries |
| Custom-competition identity, rules, membership, and shared history | Competitions | Live and My FPL summaries |
| Quantitative or attributed evidence | Explore | Live explanations, My FPL, competition detail, Lens boards |

This prevents four disconnected products while also preventing one overloaded dashboard.

## 3. Live

### Purpose

Live is LetLetMe's primary matchday destination and simplest score-checking surface. It should answer:

- What is happening to my team right now?
- What changed in my tracked official league?
- What changed in my custom competition?
- Which matches and players caused the change?
- How fresh and provisional is this result?
- What did this team or prepared competition score in a previous gameweek, without forcing me into a deeper analysis page?

Live should be the fastest and most reliable part of the website. Official FPL may supply more of the authoritative live facts, but LetLetMe still owns the experience that combines a team, prepared competitions, matches, explanation, and freshness context within a controlled resource envelope.

### Boundary

Live owns the fast result-viewing experience. The current gameweek is its default and primary state. Existing simple team and competition views may also switch to a previous gameweek, where they show finalized official values and stop live polling. My FPL and the canonical Competition object still own deeper settled analysis, trends, and season history.

Live does not create or prepare competitions, make transfer recommendations, or perform official FPL actions. Live Points is a presentation surface, so it does not need an official-action call to action.

### Opening Live

Do not build a separate Live Overview yet. Opening the top-level section should continue directly into the linked entry's Live Points where possible, with the last viewed supported live object or the Live Points lookup as fallbacks. A composed overview should be reconsidered only if observed use shows that managers regularly need a cross-object matchday scan.

### Sub-pages and object views

| Target sub-page | Purpose | What it should contain | Existing implementation | Product decision |
| --- | --- | --- | --- | --- |
| **Live Points** | Show one entry's current or selected-gameweek score in the simplest possible presentation | Team and manager identity; current/past gameweek selector; gross and net points; transfer hits; chip; captain; starting XI and bench exactly as returned by the official source; player status, contribution, bonus, and point breakdown; last update; provisional/final label; share; optional link to deeper settled review | Live Points and Team Live routes already provide entry lookup, linked-team seeding, 30-second active-page refresh, gameweek selection, squad layout, hits, chips, captaincy, player contribution, bonus, event breakdown, retained data, and sharing | **Keep the Live Points name and interaction.** Default to the linked team and retain arbitrary entry lookup. Current gameweeks refresh; previous gameweeks use finalized official values and do not poll. Do not predict or separately report automatic substitutions: reflect the official squad when upstream changes it. Do not add an official-action call to action. A change summary is optional, not a requirement of this simple page |
| **Live Competitions / Competition Live** | Follow the current or selected-gameweek result of an already tracked official league or prepared custom competition | Clear source, roster behaviour, and rules; identity and format; setup/readiness; gameweek selector; live or finalized standings, groups, matchups, or bracket; manager pinned; search, sort, captain/chip filters, player ownership and team exposure; entry comparison; lightweight rules and participant context; partial/stale states; movement; direct deeper-history link | Live Tournaments and its detail route already provide official-league roster synchronization machinery, custom membership, live calculation, tables, comparison, filters, roster, rules, setup progress, retries, retained failed rows, snapshot freshness, and management links | **Keep and rename Live Tournaments to Live Competitions.** A tracked league synchronizes its upstream roster between gameweeks and uses official finalized results; a custom tournament follows its selected membership and LetLetMe rules. Current gameweeks use the live contract; previous gameweeks remain available in the same simple view with finalized official values and no polling. Full setup, management, and history remain in Competitions |
| **Live Matches** | Explain the real matches producing FPL outcomes | Match status and minute; score; goals, assists, cards, saves, defensive contributions, BPS and projected/final bonus; player FPL points; update state; match navigation; share; links to affected players, the user's team, leagues, and competitions | Live Matches already groups matches by state, auto-refreshes, exposes player points and match events, supports retained results after refresh failure, and creates shareable summaries | **Keep and connect.** Add personal impact and deep links so it answers why the manager's result moved, not only what happened in the fixture |

### What is already strong

- Revision-aware polling and visibility/connectivity-aware refresh.
- Explicit current-gameweek gating.
- Live team squads and point explanations.
- Live custom-competition tables, filters, comparisons, and setup states.
- Retained last-known-good custom-competition rows when individual recalculations fail.
- Match-level events, player points, BPS, bonus, and sharing.
- A backend snapshot and calculation foundation that can be narrowed when official live facts become trustworthy.

### Gaps and next product work

1. **Publish a visible Live reliability contract.** Every live view should use the same language for last update, provisional, delayed, partially retained, settled, and unavailable states. Users should see which facts are official and which remain LetLetMe-derived.
2. **Pass the first-live-gameweek official-data gate.** Verify official bonus, entry totals, official squad updates after upstream substitutions, hits, chips, league membership, entry-count reporting, pagination, rate limits, cadence, failures, and finalization before retiring local responsibilities. LetLetMe should consume the official post-substitution squad, not predict the substitution itself.
3. **Keep official-league admission controlled.** An official league must be explicitly admitted for tracking before LetLetMe provides its full live table and analysis. Make one inexpensive source request to determine its entry count; admit at most 500 entries and reject 501 or more at creation. Any user who can use the normal creation flow may start tracking. Do not build a public arbitrary-league live lookup.
4. **Maintain admitted leagues for the season.** Synchronize official membership between gameweeks and freeze it while a gameweek is active. If an admitted league later grows beyond 500, continue maintaining it through that season and re-evaluate admission for the next season.
5. **Share source work without deduplicating tournaments.** Reuse official entry and league evidence across every dependent report and tournament. Preserve separate tournament membership, rules, results, and audits. Reliable official live totals may replace duplicated official-score calculation, but they do not remove the preparation boundary.
6. **Explain relevant change where it earns its space.** Rank, matchup, bonus, and data-state movement can improve Live Competitions, Matches, or Lens. Do not make a change summary mandatory on the deliberately simple Live Points page.
7. **Support current-to-final continuity without forced navigation.** Live Points and the simple competition result view should retain their gameweek selector. Past gameweeks show settled values in place; a secondary link may lead to deeper My FPL or Competition review.
8. **Connect matches to personal outcomes.** Highlight squad players and the leagues or competitions affected by a match event without turning the match page into a full duplicate of Team Live.

### Product test

Live succeeds when a manager can open a team or an already prepared competition quickly; understand the current result and its freshness; and check a past score in the same simple result view without being forced into deeper analysis. An unprepared official league must not trigger an unbounded live calculation path.

## 4. My FPL

### Purpose

My FPL is the private, persistent home for the manager's linked FPL identity. It should remember the manager and their context, lead with what matters in the current gameweek phase, preserve the finalized official team record, and connect personal league and competition outcomes to relevant evidence.

It should answer:

- What matters to my team right now?
- What changed that matters to me since I last checked?
- How did my last gameweek finish?
- How is my team and season developing?
- How am I doing in my official leagues?
- What is happening to me inside my LetLetMe competitions?
- Which players, rivals, or comparisons did I save?

### Boundary

My FPL owns personal continuity, relevant change, and settled personal interpretation. It does not operate the official team, recommend transfers, become a transfer planner, administer shared competition rules, reproduce a full competition report, or replace Explore as the canonical evidence library.

Account, security, FPL binding, language, and session management remain utility account surfaces rather than primary My FPL content.

### Sub-pages and object views

| Target sub-page | Purpose | What it should contain | Existing implementation | Product decision |
| --- | --- | --- | --- | --- |
| **My FPL Overview** | Be the default personalized return surface across the season | Team and manager identity; one phase-aware primary state; latest settled result or current Live handoff; rank and meaningful movement; bounded official-league and competition summaries; material change since the last successful view; saved context; continue actions. Before a deadline, squad context means the latest publicly frozen squad, not the manager's current private draft | The homepage Personal Desk already shows linked-team identity, total points, overall rank, team value, and official-league ranks. It is useful seed material but remains embedded in a public homepage and does not remember broader context | **Build by extending and relocating the personal foundation.** Keep only a compact preview on the public homepage. Lead with one relevant state rather than an equal-weight card dashboard |
| **Team** | Preserve and explain the manager's official settled team record | Season/gameweek switch; scoreboard; finalized official squad and bench; points, rank, value and bank; captaincy; transfers and hits; chips; official substitution markers where explanatory; season charts; gameweek log; past seasons; player-evidence links; last-provisional-to-final reconciliation when a trusted baseline exists; one secondary official-FPL action | My Team is one of the strongest existing surfaces. It already provides season/gameweek views, squad, captain and bench history, transfers, chips, rank/points/value metrics, charts, detailed gameweek history, and past-season rank history. Its multi-gameweek tabs show only one gameweek at a time | **Keep and integrate.** Replace the in-page multi-gameweek workspace with a simpler Season/Gameweek control unless a distinct comparison use case is established. Do not build a separate automatic-substitution status workflow |
| **Leagues** | Show the manager's personal position across their official FPL leagues without implying that every league has been collected | All linked-entry league names, types, personal ranks, and movement available from the cheap official summary; explicit LetLetMe tracked-preparation coverage; for prepared leagues, a bounded personal summary and associated Live/Competition links; for unprepared leagues, a tracking-creation handoff whose source-count check enforces the 500-entry gate | The homepage shows official-league rank rows, GraphQL exposes entry leagues and stored league event results, and current deep league analysis is reached through a singular tournament enrichment | **Build around explicit coverage and zero-to-many associations.** Full tables and field-wide history belong to canonical Competition objects. Basic H2H rows may be shown; deeper official H2H remains gated by verification |
| **Saved context** | Make later visits more useful than the first without becoming a feed | Saved players; saved comparisons; followed rival entries; pinned competitions; explicit last-seen state; concise material changes; cross-device persistence; contextual view-all when needed | No durable product surface currently stores this context. Current selections and recent choices are local-device conveniences | **Build a bounded, typed personal model.** Publisher/source following remains owned by Explore and may surface here later. Saved context does not need a permanent top-level submenu |
| **Personal competition summaries** | Show what prepared competitions mean for this manager without duplicating the shared competition product | A bounded set of active personal summaries: position or matchup, latest result, movement, setup attention where relevant, and shortcuts to Live or the canonical Competition object | My Tournament currently combines rich manager metrics with full standings, field metrics, captaincy, chips, top scorers, risers/fallers, and season charts | **Rehome, do not delete.** Reuse manager-summary models in My FPL; move the full shared table, rules, roster, bracket, reports, and permanent history to Competitions. Do not retain `My Tournament` as a permanent My FPL sub-page |

### Review and history are states, not another main section

Do not restore Review or Results as a fifth primary navigation category. Review is the settled state inside Team, tracked Official Leagues, and custom Competition detail.

The manager-centric view and shared competition view may reuse the same data and components:

- **My FPL:** What did this result mean for me?
- **Competitions:** What happened to the whole competition?

### What is already strong

- Verified FPL entry binding and authenticated personal reads.
- A strong My Team season and gameweek review.
- Rich captain, bench, transfer, chip, rank, value, and history models.
- A homepage seed for team identity and official-league ranks.
- Deep personal and field metrics inside the current My Tournament implementation.
- Official-settled data rather than dependence on the last provisional live calculation.
- Canonical Data checkpoints for current-season entry history and prepared league/tournament reports.

### Gaps and next product work

1. **Create a dedicated, phase-aware My FPL home.** Move the full personal experience off the public homepage and lead with the single most relevant current state.
2. **Make the FPL binding season-aware.** Persist binding history or an equivalent season-scoped authority; never carry a prior-season entry ID forward without revalidation.
3. **Define a bounded persistent-context model.** Store saved players and comparisons, followed rivals, pinned competitions, and last-seen baselines with explicit privacy, retention, caps, and rollover rules.
4. **Build coverage-aware personal league summaries.** Show cheap personal rank information for all linked leagues, but require the league to be tracked for Live and deeper stored analysis. Keep full tables in Competitions.
5. **Replace the singular league-to-tournament enrichment.** Model the official league as a season/type/ID source with zero or more associated Competition objects and distinguish tracked official-league from custom associations through explicit competition kind.
6. **Add relevant-change computation.** Compare a bounded trusted personal state with the baseline from the user's last successful view; do not mark background fetches as seen.
7. **Split My Tournament correctly.** Reuse manager-centric summaries in My FPL and move every shared field report into the canonical Competition object.
8. **Keep Overview reads bounded.** Fetch personal summaries, not one full standings payload per competition.
9. **Connect Live and settled Team review.** Preserve one trusted provisional checkpoint per prepared entry/event and explain only identified differences from the official final record. Do not build automatic-substitution prediction or status tracking.
10. **Expose authority and coverage once per page.** Carry finalization, source-check time, and prepared-through-event metadata from Data through GraphQL without repeating audit detail on every card.
11. **Link personal facts to evidence and official action.** Open player/fixture/market evidence contextually; use one secondary official-FPL handoff where an action is relevant.
12. **Defer notification dependence.** First make the on-site personal continuity valuable; any later return triggers must be opt-in and material.

### Product test

My FPL succeeds when a returning manager is recognized for the active season, sees the most relevant current state and material changes without rebuilding context, and can understand their finalized team plus their personal position inside official leagues and prepared competitions.

## 5. Competitions

### Purpose

Competitions is LetLetMe's prepared group layer. It supports tracked official leagues and LetLetMe-created tournaments. A tracked league preserves official membership, standings, and league-level reports; a custom tournament may use that league as a participant source while keeping its own selected membership, rules, results, and audit. Both are prepared before LetLetMe promises full live tables, weekly analysis, auditing, and history.

It should answer:

- What competitions am I in or running?
- Am I tracking an official league or opening a LetLetMe custom format?
- How does this format work?
- How do I bring the group in?
- What is happening now?
- What happened after the gameweek settled?
- What needs attention from the organizer?

### Boundary

Competitions contains tracked official leagues and LetLetMe custom tournaments. The source, roster behaviour, and rules must always be understandable:

- A **tracked official league** synchronizes its upstream roster between gameweeks, freezes membership during active play, uses the official finalized record, and stores weekly evidence for consistent analysis and reports. It must have at most 500 entries when first admitted; once admitted, it remains maintained through that season even if it grows.
- A **custom tournament** has a selected LetLetMe roster of at most 500 entries, plus LetLetMe-defined rules, gameweek window, standings, groups, matchups, or brackets. Its source official league may be larger than 500, provided participant selection is bounded and does not crawl the complete source.

One official league may provide participants and shared evidence for any number of custom tournaments. Each tournament remains a different object with its own membership, rules, results, history, and audit.

The approved object and lifecycle rules are:

- Persist competition kind and season explicitly. Do not infer kind permanently from roster mode, source type, name, or format fields.
- Persist one season-scoped official source for each league type/ID and share its membership checkpoints, official evidence, coverage, and source audit without merging distinct competition objects.
- Treat a one-time fixed roster or selected subset copied from an official league as a custom tournament. The tracked-league path always means official roster synchronization; it never silently degrades to a snapshot.
- Treat competition names as non-unique display metadata. Stable identity comes from the competition ID.
- Attach organizer authority to a stable LetLetMe user; attach competitive participation to the user's season-specific FPL entry.
- Give custom tournaments a draft/enrollment period, invitations or seeded participants, a roster lock, preparation, active play, completion, and archive. Structural rules and membership are editable before lock and immutable after it in the initial implementation.
- Keep competitions private by default. My Competitions and full object views are for organizers and participants; invitation previews expose only a sanitized projection. Do not create a public competition directory.
- Use archive as the normal removal operation once shared results exist. Restrict ordinary organizer hard deletion to competitions without published results.
- Expose a format in Create only after creation, explanation, setup, Live, settlement, history, and management work end to end.

### Sub-pages and object views

| Target sub-page | Purpose | What it should contain | Existing implementation | Product decision |
| --- | --- | --- | --- | --- |
| **My Competitions** | Help participants and organizers resume the right prepared object | Tracked official leagues and custom tournaments with unmistakable labels; active, setting-up, paused, and finished states; current position or matchup; next relevant gameweek; invitations where applicable; setup attention; search and useful filters; create action | Browse Tournaments already lists competitions linked to the verified entry, supports search, type/status/admin filters, sorting, progressive rows, live links, and management links | **Keep, rename, and reprioritize.** Default to personally relevant active states and expose the official source, roster behaviour, and custom rules that govern the object |
| **Create** | Start tracking an official league or prepare a custom tournament within known limits | First choose the intent. Track path: official URL/ID, one entry-count check, creation-time 500-entry admission limit, official roster preview, setup progress and recovery. Custom path: name, selected/imported participants capped at 500, format, rules/tie-breaks, gameweek window, groups/qualifiers, knockout settings, validation, invitations, setup and recovery. A source above 500 requires bounded selection rather than full-roster loading | New Tournament already supports a recommended copied-Classic path plus a custom builder. It validates names and official URLs, fetches participants, supports subsets, points-race groups, single/double elimination, schedule rules, background setup, and help | **Keep both paths and explain the difference.** Tracking is the resource-controlled way to obtain full official-league Live and reports; the custom path is the differentiated social format. Reuse source evidence, but allow many tournaments from the same league |
| **Competition Home** | Give each prepared object a permanent identity before, during, and after live play | Object kind; official source where relevant; roster behaviour; name, organizer, status, format/rules summary, participant count and roster, current stage, next/current/last result, setup state, live entry, latest settled result, history, appropriate invite/share action, and management access | The canonical tournament route currently redirects directly to its Live detail. The Live detail already carries identity, rules, roster, lifecycle, live standings, and management links | **Build a stable canonical object page.** It should select the most relevant current state while keeping setup, roster/rules, history, and links available outside a live gameweek |
| **Competition Live** | Show the current shared result | For tracked leagues: official-rule standings plus LetLetMe analysis. For custom tournaments: format-specific standings, groups, matchups, or bracket. Both: points and movement, search/filter/compare, manager pinned, provisional state, participants, relevant player differences, freshness, and setup/degraded state | Current Live Tournament is strong for standings, squad comparison, points-race filters, setup progression, partial results, roster, and rules | **Keep and complete.** Use official live totals where trustworthy for tracked leagues while preserving scheduled collection and history. Ensure every custom format has an understandable live presentation and settled continuation |
| **Results and History** | Preserve the settled shared record and tell its story | Final gameweek result; official league standings or finalized custom groups/matchups/bracket; personal movement; top scorers; risers/fallers; leader and average gaps; captain/chip/bench/hit/transfer context; source/tournament audit state; stage and season path; shareable result objects | My Tournament already provides substantial points-race and official-league-based review, personal rank and gap metrics, standings, field leaders/averages, captain/chip summaries, risers/fallers, and charts. GraphQL also contains battle-race and head-to-head result structures not fully exposed as one Web journey | **Rehome and extend by scope and format.** Official finalized totals control league and entry records; LetLetMe rules control custom results. The shared record belongs to Competition detail; manager-specific extracts may also appear in My FPL |
| **Invitations and Join** | Convert a custom competition into a social product people actually use | For custom competitions: shareable invitation, inviter and competition identity, rules preview, participant eligibility, join/accept state, membership confirmation, full/closed/error states, and organizer visibility. Tracked leagues instead synchronize the upstream roster | Creation imports or selects existing FPL entry IDs, but there is no complete invitation and participant-onboarding journey | **Build for custom competitions before adding many more formats.** Do not add a second roster policy to a tracked official league |
| **Manage** | Let an organizer operate and recover a prepared object safely | Shared: rename/display metadata, status, pause/resume, setup retry, archive/delete, and audit-friendly confirmations. Tracked-league-specific: official source and roster-sync state. Custom-specific: immutable rules summary, participant/role and invitation controls | Manage Tournament already supports rename, read-only structure, pause/resume/catch-up, setup retry, eligible official roster sync, lifecycle feedback, and exact-name deletion confirmation | **Keep and extend by behaviour.** Preserve synchronized official membership for tracked leagues and immutable structural rules once custom results depend on them |

### What is already strong

- Official-league URL parsing and participant acquisition.
- Custom participant selection and validated schedules.
- Points-race groups and knockout configuration in the Web flow.
- Additional battle/head-to-head data structures in GraphQL.
- Background preparation with visible phases, warnings, retry, and readiness.
- Live standings, filters, entry comparisons, participant rosters, and rules.
- Rich finalized points-race review and competition-field metrics.
- Owner-only lifecycle and destructive management controls.

### Gaps and next product work

1. **Correct the public model and vocabulary.** Rename Tournament to Competitions in public navigation and copy. Use competition for one object and Competitions for the category.
2. **Keep official-Classic tracking as the resource-control product.** Require explicit setup, enforce the 500-entry cap when tracking is created, allow any normal user to start it, maintain an admitted league through the season, reuse source evidence, and never promise full league Live or reports from an unprepared arbitrary ID. Add official H2H tracking later after the initial Classic experience and limited end-to-end H2H verification.
3. **Separate source identity from competition identity.** Store one season-scoped official source and reuse its evidence without deduplicating user-visible competition objects or their custom results.
4. **Correct creation semantics and limits.** The first choice is Track an official league or Create a custom tournament. Enforce 500 in every layer, remove the silent snapshot downgrade, and use explicit entries or enrollment instead of crawling a complete oversized source.
5. **Create a permanent Competition Home.** Do not force one canonical URL to mean only the current live table.
6. **Complete the social activation loop.** Custom draft, invitation, join/claim, roster lock, membership clarity, and organizer progress are required for a competition product. Tracked leagues continue to use official membership.
7. **Use stable ownership and safe lifecycle rules.** Store organizer authority against a LetLetMe account, allow structural edits before custom roster lock, preserve published records through archive, and make hard deletion a server-controlled pre-publication action.
8. **Complete formats end to end.** A backend enum or result table is not a user feature until creation, explanation, setup, live presentation, settlement, history, and management all work together.
9. **Prioritize existing-format completion over format count.** Measure creation-to-ready, invitation acceptance, active entrants, matchday return, gameweek completion, and season completion before funding more rule types.
10. **Preserve format-specific stories.** A points race, battle group, and knockout should not all collapse into the same generic standings table.
11. **Reduce duplicated scoring without deleting tracked-league preparation.** When official live totals prove trustworthy, consume them as authoritative inputs while retaining roster checkpoints, weekly data collection, source and tournament audits, reports, and the fallback needed for incomplete official contracts.

### Product test

Competitions succeeds when a manager can deliberately prepare an eligible official league within LetLetMe's resource limits, or create an understandable custom format and bring the group in; both paths must reach a reliable live result and preserve a trustworthy final record without technical support.

## 6. Explore

### Purpose

Explore is the evidence layer for managers who want to understand what is changing before and after matches. It should make quantitative data and attributed public information approachable without pretending that popularity, forecasts, or creator opinions are facts.

It should answer:

- What happened in this gameweek?
- Which fixture environments are changing?
- What is moving in the player market?
- What are defined manager fields doing?
- What does the evidence say about these players?
- What are credible named sources reporting or discussing?

### Boundary

Explore presents evidence, scope, uncertainty, and disagreement. It does not issue buy, sell, avoid, essential, best-captain, optimized-team, or community-consensus conclusions.

### Sub-pages and object views

| Target sub-page | Purpose | What it should contain | Existing implementation | Product decision |
| --- | --- | --- | --- | --- |
| **Explore Overview** | Make evidence discoverable without requiring users to know which tool to open | Current gameweek phase; important official changes; market and fixture changes; followed-player updates; new Briefing topics; recently used comparisons; non-AI search across players, clubs, gameweeks, cohorts, topics, and sources; direct links into detailed evidence; visible source/freshness labels | No Explore landing page exists. Data is a dropdown of five direct tools, and the homepage exposes selected gameweek, fixture, and market fragments | **Build lightly.** Compose relevant change and entry points; do not build an infinite news or recommendation feed or duplicate the whole-site homepage |
| **Gameweek** | Describe the official round at overall-field level | Gameweek status and deadline; average and highest score; most selected/captained/vice-captained; chip usage; dream team; double-digit hauls; top transfers; provisional/settled state and update time | Gameweek already exposes overview, dream team, haul, transfers, chips, official status, update time, and preseason/empty states | **Keep and contextualize.** Add defined cohort comparisons where useful and link results to relevant players, My FPL, and competition contexts |
| **Fixtures** | Compare official fixture environments without turning FDR into a transfer verdict | Selectable horizon; FDR matrix; easiest/hardest runs; next fixtures; BGW/DGW; schedule; linked-squad overlay; neutral player review groups; exact source and window; player deep links | Fixtures already has FDR horizons, sorting, glance cards, team matrix, BGW/DGW, linked-squad view, schedule, market-assisted neutral candidate groups, sharing, and player links | **Keep and correct language.** Remove residual advisory metadata such as players to hunt or premiums to avoid, preserve confirmed blank versus unavailable states, and deepen My FPL/watchlist context |
| **Market** | Show observed changes in price, ownership, availability, and transfers | Current view mode; observation window; price rises/falls; ownership movement; availability changes; new players; transfer momentum; current ownership; player lookup and price history; capture freshness and missing-window explanation | Market already provides price-led, availability-led, ownership-led, and baseline states; 14-day observation coverage; prices; ownership; transfers; availability; new players; player history; stale/capture messages; and sharing | **Keep and scope rigorously.** Never become an unofficial price predictor; make date/window semantics consistent and connect followed players to My FPL relevant change |
| **Trends** | Show what defined manager cohorts actually selected | Cohort selector; field definition; gameweek and collection time; exact/sample coverage and denominator; ownership, EO, captaincy, vice-captaincy, chips, formations and template; supported transfer evidence; personal exposure; week-to-week selection change; shareable cohort cards | League Trends currently supports LetLetMe tournament fields and curated public prepared competitions, ownership, EO, captaincy, transfers, top lists, field size, and personal exposure for My Leagues | **Keep, rename, and expand.** Distinguish tracked official competitions, custom competitions, curated public competitions, and rank cohorts. Add a disclosed deterministic Top-10k sample and useful rank-band samples; do not present overall FPL ownership as Top-10k behaviour or infer transfers from sample-membership churn |
| **Players** | Let a manager inspect or compare players under one visible scope | Search/filter; one-player overview; optional two-player comparison; identity, price, availability, recent role and minutes, current and season FPL output, fixtures, market movement, official expected metrics, position-relative context, verified real-match evidence kept separate, history, coverage, share and deep links | Player Stats is already broad: player directory, one/two-player state, availability, fixtures, recent gameweeks, market and price history, season production, ICT, official expected metrics, verified Understat process, historical evidence, coverage, My Squad rail, and deterministic Player State | **Keep and simplify around user questions.** Preserve evidence separation and withheld states, make scope and missing-data semantics explicit, and add attributed player Briefing context. Per-metric difference emphasis is acceptable for valid like-for-like comparisons; no aggregate score, winning player, or transfer conclusion is allowed |
| **Briefing** | Compress useful public information while preserving source identity and disagreement | Topic boards organized around a player, club, gameweek, or recurring question; official/club updates; reporter and publisher information; YouTube/video metadata and permissioned summaries or transcripts; social/forum posts; named creator/KOL opinions; a short evidence timeline; direct source links; repeated themes; disagreement; source follow/mute controls; rights basis and coverage | No Web, GraphQL, or Data implementation currently ingests or presents these public sources | **Build as a new evidence class, not a social feed.** Start with an allowlisted source registry, rights policy, entity linking, attribution, deduplication, correction/removal handling, and a small set of high-value topics. Do not assume scraping or redistribution access |

### Player State boundary

The existing deterministic Player State can remain inside Players as an optional **Evidence Summary** when it:

- Describes current evidence rather than predicting future points.
- Shows rules, reasons, coverage, sample limitations, confidence caps, and withheld states.
- Keeps official FPL output separate from verified real-match process.
- Preserves its release gate: an overall Rising/Stable/Falling headline remains withheld whenever validation has not demonstrated reliable ordering.
- Avoids buy, sell, avoid, essential, best-pick, aggregate-winner, or transfer-score language.

If it cannot meet those conditions, raw evidence is preferable to a synthesized label.

### Briefing evidence classes

Briefing must keep these visibly separate:

1. **Official or club fact.**
2. **Reporter or publisher information.**
3. **Observed manager behaviour**, such as Top 10k selection.
4. **Attributed creator/KOL opinion.**

Mention volume is not consensus, and consensus is not correctness. A useful Briefing says who said what, when, under what evidence class, and where the original source can be inspected.

### Rank-cohort sampling rule

Top-10k and rank-band evidence is sampled unless an exact collector later passes an explicit resource and upstream-reliability gate. The product must say **Top 10k sample**, not imply complete coverage.

For each gameweek:

- Cohort membership is defined from the latest settled overall rank before the deadline.
- New frozen picks are captured only after the deadline.
- The sample is deterministic, stratified, versioned, and operationally capped.
- The view exposes target population, actual sample, coverage, method, rank reference, and capture time.
- Ownership, EO, captaincy, vice-captaincy, chip, formation, and template evidence may be aggregated from the sample.
- Week-to-week selection movement is not labelled as player transfers unless actual transfer evidence was collected under the same defined cohort.
- Gameweek 1 and any incomplete capture use a typed unavailable or partial state rather than a fabricated cohort.

### Search, saving, and sharing ownership

- Explore Overview owns deterministic search across players, clubs, gameweeks, cohorts, Briefing topics, and sources. It is navigation and filtering, not an assistant conversation.
- My FPL owns saved players and personal watchlist context. Explore owns followed or muted Briefing topics, publishers, and creators.
- Recently inspected players or comparisons may remain a local-device convenience, but every meaningful selection and comparison has a stable URL.
- Source-labelled, timestamped evidence cards use stable canonical Explore links and expose only data safe for the selected public or private scope.

### What is already strong

- Five substantial evidence tools rather than placeholder pages.
- Official gameweek, player, fixture, market, league-field, and entry data.
- Separate real-match provider evidence.
- Player comparison and position-aware metrics.
- FDR, BGW/DGW, squad context, price history, ownership, EO, captaincy, transfers, and exposure.
- Provisional/settled, stale, missing, preseason, and partial-data states in several surfaces.
- Shareable text summaries and stable query-driven player/league scopes.

### Gaps and next product work

1. **Rename Data to Explore.** Keep current route paths temporarily if useful, but change the public mental model and supply compatibility redirects for any later URL migration.
2. **Build Explore Overview as a router, not a feed.** It should help users find relevant evidence and recent change without replacing the detailed tools.
3. **Add sampled Top-10k and rank-band cohorts.** Use a deterministic, stratified, resource-bounded collection contract and publish rank reference, collection time, method, sample, coverage, denominator, and week-to-week selection movement.
4. **Create the Briefing foundation.** Define allowed sources, permissions, acquisition method, storage, freshness, attribution, removal, deduplication, and player/team/topic links before building a polished UI.
5. **Make context reusable.** The same evidence cards should appear inside My FPL, Live explanations, competition analysis, Players, and Lens boards with a stable canonical Explore link.
6. **Standardize evidence metadata.** Every material figure or attributed statement should expose evidence class, source, scope, freshness, coverage, and derivation.
7. **Remove residual advisory language.** Product metadata, headings, empty states, and call-to-action copy must follow the same neutral boundary as the visible page content.
8. **Preserve direct tools for power users.** Contextual reuse should not remove fast access to Gameweek, Fixtures, Market, Trends, or Players.
9. **Do not fund a forecast arms race.** External projections are only optional attributed evidence if a trusted provider, stable delivery, inspectable history, and redistribution rights exist.
10. **Add deterministic Explore search.** Route a player, club, gameweek, cohort, topic, or source directly to its evidence without introducing a question-and-answer shell.
11. **Keep saved-object ownership clear.** My FPL owns saved players and personal context; Explore owns source/topic following and muting.
12. **Standardize sharing.** Extend the existing share work into source-labelled, scoped, timestamped cards and stable URLs without exposing private personal context.

### Product test

Explore succeeds when a manager can find relevant evidence quickly, understand its scope and source, compare trade-offs, inspect disagreement, and make their own decision without LetLetMe presenting a verdict.

## 7. Cross-section journeys

The four sections should cooperate without forcing users through a prescribed funnel.

### During a live gameweek

1. Live opens with the manager's relevant current state.
2. A point, bonus, official squad, rank, or matchup change links to the player, match, or prepared competition that caused it.
3. Explore supplies supporting evidence only when the user asks or opens it.
4. When results settle, Live shows the reconciliation and hands off to My FPL or Competition Results.

### Between gameweeks

1. My FPL shows relevant change since the last visit.
2. Explore provides fixtures, market, trends, player evidence, and Briefing.
3. Saved/followed objects retain context across visits.
4. Any official transfer, lineup, captaincy, or chip action links to official FPL.

### Inside a prepared competition

1. Competitions owns setup, lifecycle, and shared history. A tracked official league follows upstream membership and official results; a custom competition follows its selected membership and LetLetMe rules.
2. Live surfaces the current result.
3. My FPL surfaces what that result means for the individual manager.
4. Explore supplies player, field, fixture, and attributed context.
5. Competitions preserves the final shared record.

## 8. Current-to-target implementation map

| Current surface | Target product home | Treatment |
| --- | --- | --- |
| Homepage Personal Desk | My FPL Overview foundation | Reuse and deepen; homepage remains acquisition-oriented |
| Live Points and Team Live | Live → Live Points | Keep the name; add reliability and current/final state clarity without adding action controls |
| Live Tournaments | Live → Live Competitions | Keep for tracked official leagues and custom competitions; rename and state their source, roster behaviour, and rules clearly |
| Live Matches | Live → Live Matches | Keep and connect to personal impact |
| No arbitrary official league route | Intentional resource boundary | Do not build a public unprepared-league lookup; route users through bounded tracked-league setup or official FPL |
| My Team | My FPL → Team | Keep and integrate |
| Homepage official-league rank list | My FPL → Leagues foundation | Reuse for cheap personal rank summaries; move the full list off the public homepage |
| My Tournament | My FPL bounded personal summaries plus Competitions Results/History | Retire as a permanent My FPL page after personal components and shared reports have canonical homes |
| Browse Tournaments | Competitions → My Competitions | Rename and reprioritize |
| New Tournament | Competitions → Create | Keep both the creation-time-capped tracked-league path and the custom builder; explain their different purposes and participant caps |
| Tournament detail redirect to Live | Competitions → Competition Home | Replace with a stable canonical object view |
| Manage Tournament | Competitions → Manage | Keep and extend activation controls |
| Data → Gameweek | Explore → Gameweek | Keep |
| Data → Fixtures | Explore → Fixtures | Keep and neutralize residual advisory copy |
| Data → Market | Explore → Market | Keep |
| Data → League Trends | Explore → Trends | Keep, rename, add sampled Top-10k/rank cohorts |
| Data → Player Stats | Explore → Players | Keep, simplify, and connect sources |
| No public-source aggregation | Explore → Briefing | Build |
| No Data category landing page | Explore Overview at `/data` | Build as a router and deterministic search surface; keep the six direct tools |

Route names may remain temporarily while public labels change. Any later route migration must preserve existing English URLs where required, support the Simplified Chinese locale path, and provide redirects that retain meaningful query state.

## 9. Product work summary

### Protect

- Live correctness, freshness, recovery, and scan speed.
- My Team's settled season and gameweek review.
- Tracked-official-league and custom-competition setup lifecycle, live tables, scheduled collection, auditing, history, and owner recovery controls.
- The five existing evidence tools and their source separation.

### Correct

- Public navigation and terminology.
- Tracked-league versus custom-tournament source, roster behaviour, rules, and report scope.
- Provisional versus settled truth contracts.
- Residual advisory wording in metadata and product copy.
- Canonical ownership of personal versus shared competition review.

### Build

- My FPL Overview, Leagues, bounded saved context, relevant change, and season-scoped identity.
- Competition Home, tracked-league admission and source-evidence reuse, bounded large-league participant selection, plus custom invitation and join journeys.
- Explore Overview and deterministic search, sampled Top-10k/rank-band Trends, Briefing, and a shared evidence-metadata contract.
- Cross-section relevant-change and Live-to-settled reconciliation.

### Rehome

- Homepage personal data into the My FPL foundation while keeping a compact acquisition/continuation preview on the homepage.
- Full shared My Tournament analysis into Competition Results/History.
- Reusable evidence cards from isolated Data pages into Live, My FPL, Competitions, and Lens contexts.

### Retire

- Duplicated local official-score or bonus calculation after official facts pass the reliability gate; keep tracked-league preparation, persistence, audit, analysis, and report responsibilities.
- Duplicate official entry fetches or league-evidence rows for the same source scope; preserve every distinct tournament object and its derived results.
- Any exact official table replica that adds no context, explanation, history, or workflow value.

### Defer or exclude

- Official FPL team operation.
- Arbitrary public live lookup or whole-league enrichment for an unprepared official league.
- Home-grown expected-points or expected-minutes models.
- Optimized teams, transfer solvers, and advisory verdicts.
- A generic newsroom, scraped paywalled content, sentiment meter, or infinite social feed.
- More custom formats until existing formats demonstrate activation and completion.
- The separate heavy planning/workspace product, which remains outside this website-section specification.

## 10. Evidence from the current implementation

- Current navigation: components/layout/config.ts
- Homepage and personal desk: app/[locale]/page.tsx, components/home/PersonalDesk.tsx
- Live team: app/[locale]/live/points/page.tsx, app/live/points
- Live custom competitions: app/[locale]/live/tournaments, app/live/tournaments
- Live matches: app/[locale]/live/matches/page.tsx, app/live/matches
- My Team: app/[locale]/me/team/page.tsx, app/me/team
- Current My Tournament review: app/[locale]/me/tournament/page.tsx, app/me/tournament
- Competition browse/create/manage: app/[locale]/tournament, app/tournament
- Gameweek: app/[locale]/data/gameweek/page.tsx, app/data/gameweek
- Fixtures: app/[locale]/data/fixtures/page.tsx, app/data/fixtures
- Market: app/[locale]/data/market/page.tsx, app/data/market
- League Trends: app/[locale]/data/selections/page.tsx, app/data/selections
- Player Stats: app/[locale]/data/player-stats/page.tsx, app/data/player-stats
- English product and metadata copy: messages/en.json
- Official league GraphQL foundation: ../letletme-graphql/src/domains/leagues
- Custom competition GraphQL model: ../letletme-graphql/src/domains/tournaments

**Validation assessment:** This specification is ready to guide information architecture, page briefs, implementation issue creation, and later design work. Product demand and priority assumptions still require real usage instrumentation.
