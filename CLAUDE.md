# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start dev server at http://localhost:3000
- `npm run build` — Build for production
- `npm run lint` — Run ESLint
- `npm test` — Run unit tests
- `npx tsc --noEmit` — Type-check without building

## Architecture

### Tech Stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **TailwindCSS 3** + **Shadcn/UI** (Radix primitives in `components/ui/`)
- **GraphQL** via a Next.js proxy route handler
- **Lucide React** for icons, **next-themes** for dark/light mode

### GraphQL Data Flow

Queries and their response types are grouped by domain under `lib/graphql/operations/`. Add each query to its owning domain module instead of creating a shared barrel.

`executeQuery<T>(query, variables?)` in `lib/graphql-client.ts` handles all fetching:

- Client-side: routes through the Next.js proxy at `/api/graphql`
- Server-side: uses `executeServerQuery` with signed `X-User-Context` headers when a session exists; public RSC reads use `executePublicServerQuery` + `lib/cache-policy.ts` (`force-cache`, revalidate, tags)
- The proxy (`app/api/graphql/route.ts`): session / Authorization / non-allowlisted ops → `Cache-Control: no-store`; allowlisted public ops (no session, no Authorization) → `public, s-maxage=60, stale-while-revalidate=300` (see `PUBLIC_GRAPHQL_OPERATION_NAMES`)

### Page Architecture Pattern

Pages with live data follow a strict split:

- `page.tsx` — thin server component, renders a `<Suspense>` boundary wrapping `*Client.tsx`
- `*Client.tsx` — owns all state, data fetching via `executeQuery`, and renders the full UI

Example: `app/live/competitions/page.tsx` → `TournamentClient.tsx`.

### Tournament Live Points Flow

`/live/competitions` is the most complex page:

1. Fetches entry tournaments for the signed-in user's FPL entry (`getCurrentEntryId()` from session)
2. Fetches `GET_TOURNAMENT_LIVE_POINTS` for the selected tournament + gameweek (in parallel with previous GW for rank deltas)
3. Builds `TournamentEntry[]` with live rank, net points, and pick lists via `lib/tournament/liveEntries.ts`
4. Filters applied in order: search/chip/captain → `PlayerOwnershipFilter` → `TeamExposureFilter` — all as `string[] | null` intersected in `filteredEntries` useMemo

### Filter Pattern

Both `PlayerOwnershipFilter` and `TeamExposureFilter` follow the same contract:

- Accept `entries` + `onMatchedEntryIdsChange: (ids: string[] | null) => void`
- Emit `null` when inactive (no filter), or an array of matched IDs when active
- Parent intersects all active filter sets in a single `filteredEntries` useMemo
- Filter logic lives in a separate lib file (`lib/player-ownership-filter.ts`, `lib/team-exposure-filter.ts`)

### Current gameweek (isCurrent) gate

**Live** calculation and “this GW” SSR seeds **must** use `getCurrentEventId()` / `pickCurrentEventId()` from `lib/events.ts` (backed by `events(filter: { isCurrent: true })`).

- **Order:** await `getCurrentEventId()` **before** entry/session seed queries when the page only needs current for gating (live points/matches/live tournaments). Auth redirects may run first on protected pages.
- **Empty UI (Live only):** use shared `CurrentGameweekUnavailable` (not ad-hoc PageState copies).
- **Route loading:** isCurrent-gated live routes use `GatedRouteLoading` in `loading.tsx` — not full dashboard skeletons (avoids fake “loaded UI” before empty state).
- **Do not** fall back to `next[0].id` or `liveSnapshot.eventId` as the **live-calc** / this-GW seed event.
- **Do not** wrap already-seeded client trees in useless Suspense that only flashes a second loading shell.

**My FPL review** (`/my-fpl/team`, `/my-fpl/competitions`) must **not** hard-fail when `isCurrent` is empty. Use `resolveReviewGameweekAnchor()` from `lib/review-gameweek.ts` (current → next-derived → history max). Season history / competition field still open; only Live keeps the hard gate.

- **Out of scope for the Live gate:** home deadline (`next`), market, tournament CRUD, Me review anchors, user switching to a non-current GW after a valid seed.

### Key Conventions

- `OwnershipScope = "any" | "starter" | "bench"` — position 1–11 = starter, 12–15 = bench — used by both ownership and team exposure filters
- `resolveTeamDisplayName(shortName, fullName?)` in `lib/team-display.ts` — always use this for displaying team names (handles overrides for relegated/promoted teams not in `types/common.ts`)
- `formatCompactNumber()` in `lib/utils.ts` — for overall rank display (50200 → "50.2k")
- Client components are marked `"use client"` and isolated in `*Client.tsx` files; everything else defaults to RSC

### Environment

- `GRAPHQL_ENDPOINT` — backend URL (dev default: `http://localhost:4000/graphql`)
- `NEXT_PUBLIC_GRAPHQL_ENDPOINT` — optional client-side override
- `eslint.ignoreDuringBuilds: true`, `images.unoptimized: true` in `next.config.js`
- Path alias `@/*` → repo root

<!-- autoskills:start -->

Summary generated by `autoskills`. Check the full files inside `.claude/skills`.

## Accessibility (a11y)

Audit and improve web accessibility following WCAG 2.2 guidelines. Use when asked to "improve accessibility", "a11y audit", "WCAG compliance", "screen reader support", "keyboard navigation", or "make accessible".

- `.claude/skills/accessibility/SKILL.md`
- `.claude/skills/accessibility/references/A11Y-PATTERNS.md`: Practical, copy-paste-ready patterns for common accessibility requirements. Each pattern is self-contained and linked from the main [SKILL.md](.claude/skills/accessibility/SKILL.md).
- `.claude/skills/accessibility/references/WCAG.md`

## Design Thinking

Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beaut...

- `.claude/skills/frontend-design/SKILL.md`

## Next.js Best Practices

Next.js best practices - file conventions, RSC boundaries, data patterns, async APIs, metadata, error handling, route handlers, image/font optimization, bundling

- `.claude/skills/next-best-practices/SKILL.md`
- `.claude/skills/next-best-practices/async-patterns.md`: In Next.js 15+, `params`, `searchParams`, `cookies()`, and `headers()` are asynchronous.
- `.claude/skills/next-best-practices/data-patterns.md`: Choose the right data fetching pattern for each use case.
- `.claude/skills/next-best-practices/error-handling.md`: Handle errors gracefully in Next.js applications.
- `.claude/skills/next-best-practices/file-conventions.md`: Next.js App Router uses file-based routing with special file conventions.
- `.claude/skills/next-best-practices/metadata.md`: Add SEO metadata to Next.js pages using the Metadata API.
- `.claude/skills/next-best-practices/rsc-boundaries.md`: Detect and prevent invalid patterns when crossing Server/Client component boundaries.

## Node.js Backend Patterns

Build production-ready Node.js backend services with Express/Fastify, implementing middleware patterns, error handling, authentication, database integration, and API design best practices. Use when creating Node.js servers, REST APIs, GraphQL backends, or microservices architectures.

- `.claude/skills/nodejs-backend-patterns/SKILL.md`
- `.claude/skills/nodejs-backend-patterns/references/advanced-patterns.md`: Advanced patterns for dependency injection, database integration, authentication, caching, and API response formatting.

## shadcn/ui

Manages shadcn components and projects — adding, searching, fixing, debugging, styling, and composing UI. Provides project context, component docs, and usage examples. Applies when working with shadcn/ui, component registries, presets, --preset codes, or any project with a components.json file.

- `.claude/skills/shadcn/SKILL.md`
- `.claude/skills/shadcn/rules/icons.md`: **Always use the project's configured `iconLibrary` for imports.** Check the `iconLibrary` field from project context: `lucide` → `lucide-react`, `tabler` → `@tabler/icons-react`, etc. Never assume `lucide-react`.

## Tailwind CSS Development Patterns

Provides comprehensive Tailwind CSS utility-first styling patterns including responsive design, layout utilities, flexbox, grid, spacing, typography, colors, and modern CSS best practices. Use when styling React/Vue/Svelte components, building responsive layouts, implementing design systems, or o...

- `.claude/skills/tailwind-css-patterns/SKILL.md`

## React Composition Patterns

Composition patterns for building flexible, maintainable React components. Avoid boolean prop proliferation by using compound components, lifting state, and composing internals. These patterns make codebases easier for both humans and AI agents to work with as they scale.

- `.claude/skills/vercel-composition-patterns/SKILL.md`

## Vercel React Best Practices

React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be used when writing, reviewing, or refactoring React/Next.js code to ensure optimal performance patterns. Triggers on tasks involving React components, Next.js pages, data fetching, bundle optimizati...

- `.claude/skills/vercel-react-best-practices/SKILL.md`

<!-- autoskills:end -->

## Codex-maintained governance

Use `.agents/skills/letletme-web-request-path/SKILL.md` for repository-specific
Web request-path work. Generic skills listed above remain repository inputs;
they are not replaced or repackaged by this change.

## Governance and review

- Global routes in `.codex/global-skills.json` are provisioned from immutable `tonglam/codex-workspace-config@7e92336ec04d38f7bb95620e304ce6ec6567c896:registry/workspace-assets.json` with its recorded SHA-256 content digest into the host Codex mount. Provision that source before invoking a route; run `python3 .codex/provision_global_skills.py --manifest .codex/global-skills.json --apply` when the host mount is absent, or append `--allow-network` only when network access is explicitly approved and no authenticated local source is available. If provisioning or the mount is unavailable, stop and report the missing dependency rather than silently substituting it or fetching implicitly.
- Use `$gh-codex-review-loop` for PR work. A review may be skipped only after two consecutive explicit quota-limit responses for the unchanged head; record both responses and the exact SHA. This never waives CI, findings, or cleanup.
- Every P0-P3 finding must be dispositioned and its thread resolved. Only a finding confined to tests/scripts gets the time exception: implement P0/P1, and explain plus resolve P2/P3 without implementation time. P2/P3 anywhere else must be actually fixed and verified.
- Keep a complete finding ledger for the exact head; merge is prohibited while any finding is undispositioned or any review thread is unresolved. A quota override can skip only a new review request and never finding resolution.
- After merge, clean only the exact corresponding worktree, local branch, and remote branch after verifying identity; leave unrelated WIP untouched.
