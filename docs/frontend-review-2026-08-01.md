# Frontend architecture, performance, and UX review

Date: 2 August 2026
Branch: `codex/frontend-review-improvements`

## Executive verdict

The reviewed frontend is release-ready. Next.js Server Components own route composition and initial data where useful, interactive work is contained in small client islands, volatile data is never presented as cached truth, and backend failures render explicit recovery states. The largest feature clients and the monolithic GraphQL operation file have been decomposed, tournament management now has an authenticated server-owned mutation path, and automated coverage protects the public mobile, accessibility, auth-error, storage-recovery, and outage experiences.

No known P0 or P1 frontend issue remains from this review. Production rollout and authenticated live validation are tracked as release activities rather than deferred code work.

| Area | Verdict | Evidence |
| --- | --- | --- |
| Component separation | Strong | Large clients are split into route-private model, hook, and view modules; duplicate live-points orchestration was removed. |
| Server/client boundaries | Strong | Route entry files remain Server Components; browser APIs, forms, polling, and Web Vitals reporting are isolated client-side. |
| Repository organization | Strong | GraphQL operations are grouped by domain; route-private code is colocated; reusable primitives remain shared. |
| SOLID and composition | Strong | Data access, state orchestration, derivation, and presentation have explicit boundaries; composition replaces boolean-heavy monoliths. |
| Backend API use | Strong | Server-owned identity, bounded bodies, timeouts, same-origin mutation checks, accurate field contracts, and honest errors. |
| Fallbacks and rendering | Strong | Global, route, section, empty, partial-data, offline, timeout, and not-found states are present and browser-tested. |
| User performance | Strong lab baseline | Lighthouse home scored 96 performance and 100 accessibility/best-practices/SEO; production RUM now records privacy-bounded Core Web Vitals. |
| Cache, storage, context, state | Strong | Cache policy follows volatility; browser storage is small and validated; bounded in-memory caches replace global context where appropriate. |
| shadcn and Tailwind | Strong | Shared shadcn primitives, semantic design tokens, consistent focus/contrast/radius behavior, and responsive Tailwind composition. |
| UI/UX and accessibility | Strong | Keyboard skip path, accessible dialogs/forms, mobile navigation, meaningful status language, reduced motion, and no axe violations in covered flows. |

## What changed

### Architecture and rendering

- Split player statistics, live points, team statistics, tournament statistics, tournament creation, and match cards into focused model, hook, and presentation modules.
- Reused the live-points model for the single-team route and removed unsupported pitch and transfer panels rather than displaying invented data.
- Split GraphQL queries and types into event, entry, player, live, price, and tournament operation modules.
- Kept page/layout files server-first and moved interactivity into explicit client components.
- Removed the root events dependency and obsolete global event context so unrelated pages do not wait on the backend.
- Added global loading, error, global-error, and not-found boundaries plus shared page loading/state components.

### Backend boundaries and tournament management

- Added an owner-only tournament management page with immutable ownership and structure fields.
- Added rename and delete routes that resolve a fresh verified session, reject browser-controlled identity, enforce same-origin requests, bound request bodies, and inject the verified FPL entry server-side.
- Added matching Data API operations with Zod validation, ownership checks, duplicate-name handling, a row-locked transactional delete, and safe HTTP error mapping.
- Replaced browser-native confirmation with a controlled shadcn Alert Dialog requiring the exact tournament name before deletion.
- Tightened tournament creation contracts for secure FPL URLs, name length, gameweek ordering, positive numeric structure fields, bounded participant lists, and malformed participant responses.
- Added request cancellation and timeouts to GraphQL and tournament service calls; live/authenticated requests remain `no-store`.

### State, caching, and resilience

| Data | Policy |
| --- | --- |
| Current/next events | Server cache with five-minute revalidation and request memoization. |
| Fixtures | Five-minute server revalidation. |
| Price aggregates | One-hour server revalidation. |
| Live points, selections, tournament standings | `no-store`; visibility- and connectivity-aware polling. |
| Entry history and live derivations | In-memory dedupe with TTL, expiry pruning, and hard entry caps. |
| Theme and small UI preferences | Validated enum-like `localStorage` values only. |
| Recent player slots | Versioned, schema-validated local storage; corrupt values are discarded. |
| Tournament mutations | No browser cache; server authorization is re-evaluated for every command. |

### Design system, UI, and accessibility

- Consolidated colors into semantic primary, success, warning, info, muted, and destructive tokens across light and dark themes.
- Restored complete shadcn primitive APIs and standardized borders, radii, focus rings, dialogs, sheets, tables, and touch targets.
- Reworked navigation, home hierarchy, footer, loading/empty/error states, and mobile behavior into one emerald/navy visual language.
- Removed fake, dead, duplicated, and misleading UI, including the non-functional language switch and fabricated match/player information.
- Added accessible names, descriptions, error associations, landmarks, sequential headings, a working skip link, reduced-motion handling, and non-color-only link cues.
- Ensured destructive tournament behavior uses an accessible in-product dialog and preserves keyboard focus.

### Performance and observability

- Re-enabled Next.js image optimization and reduced display-font preload cost.
- Server-seeded key routes to avoid avoidable client waterfalls and removed duplicated data work.
- Added a sampled Web Vitals reporter for CLS, FCP, INP, LCP, and TTFB. Dynamic identifiers and query strings are normalized out, payloads are bounded, no user identity is included, and delivery uses `sendBeacon` with a keepalive fallback.
- The comparable local Lighthouse home run recorded 96 performance, 100 accessibility, 100 best practices, 100 SEO, 0.8 s FCP, 2.7 s LCP, 0 ms blocking time, and zero layout shift.

## Automated verification

- Frontend unit/security/model tests: 98 total, 96 passed, 2 database-only tests skipped, 0 failed.
- Playwright browser suite: 7 passed, covering desktop/mobile navigation, skip link, axe accessibility, theme persistence, in-app auth errors, corrupt storage plus backend failure, and protected-route redirects.
- Frontend ESLint: passed with zero warnings or errors.
- Frontend TypeScript: passed.
- Frontend production build: passed on Next.js 16.2.12. Backend-dependent static routes rendered their intended fallback states while the local GraphQL service was deliberately unavailable.
- Data API unit suite: 470 passed, 0 failed.
- Data API focused tournament/domain/handler suite: 48 passed, 0 failed.
- Data API lint: zero errors; seven pre-existing warnings outside this change.
- Data API TypeScript and production bundle: passed.
- `git diff --check`: passed in both repositories.

CI remains responsible for the database-backed Web tests and Data integration suite because those jobs provision isolated PostgreSQL and Redis services. Production Core Web Vitals should be evaluated from collected percentiles after sufficient real traffic; that is ongoing measurement, not a release blocker.
