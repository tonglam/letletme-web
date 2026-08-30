# letletme-web

## Repository profile

- Package manager: npm with `package-lock.json`. Runtime: Next.js 16 App Router, React 19, TypeScript, next-intl, Better Auth, Drizzle/PostgreSQL, Playwright, and Tailwind CSS 3. Do not apply Tailwind 4 assumptions.
- Web owns product UI, locale routing, Better Auth, verified FPL-entry binding, Mini Program sessions, the `bauth` schema, and the public `/api/graphql` boundary.
- Data owns canonical FPL data and publication. GraphQL owns public/domain reads. Web must not recreate either layer's business truth or let a browser/Mini client reach their private origins directly.

## Read path

- Localized pages live under `app/[locale]`; many are thin route/metadata/server-seed shells that import the real implementation from `app/data`, `app/live`, `app/me`, `app/tournament`, or shared components. Trace both before editing.
- GraphQL documents and response types live in `lib/graphql/operations`. Browser code uses `executeQuery()` and therefore the origin-relative `/api/graphql` proxy. Server components use the helpers in `lib/graphql-server.ts`; do not call the browser proxy from RSC code.
- `/api/graphql` owns bounded bodies, safe Mini authorization forwarding, signed ingress, fresh authorization sessions, user envelopes, upstream timeouts, safe response headers, cache policy, and request telemetry. Extend those helpers instead of constructing headers ad hoc.
- `GRAPHQL_ENDPOINT`, `BACKEND_PROXY_SECRET`, and `GRAPHQL_SERVICE_TOKEN` are server-only. Never expose private origins, service credentials, signed envelopes, cookies, or raw client identity to browser bundles or logs.
- Route protection is optimistic in `proxy.ts` and authoritative again in sensitive route handlers/RSC. A cookie hint is not authorization; use fresh-session helpers for authorization decisions.

## Auth and database

- Web is the sole migration owner for `bauth`; schema declarations are in `lib/db/schema/auth.ts` and append-only SQL history is in `drizzle/`. Never edit an applied migration or the journal timestamp/order.
- Runtime access must use the bounded `letletme_web_runtime` login through `DATABASE_URL`. Migrations require `DIRECT_DATABASE_URL`, PostgreSQL 15+, the repository runner, and its advisory-lock/ledger checks. Never run migrations through the transaction pooler or with a broad Data/GraphQL role.
- Preserve the separation among display-only cookie-cached sessions, fresh authorization sessions, verified entry identity, and Mini Program device sessions. Read `docs/auth.md` before changing auth, binding, session, proxy, or database policy.

## Change routing

- For a normal Web feature or bug, use `$letletme-web-request-path`; a single-repository task needs no cross-repo Change ID.
- If behavior requires a Data schema/publication, GraphQL field/resolver, Mini Program contract, or Ops release change, stop treating it as Web-only and use `$letletme-stack-audit` to register and trace the affected repositories.
- Use `$letletme-web-dev-environment` for local servers, ports, environment profiles, Playwright, or stale-process diagnosis. Use `$gh-codex-review-loop` only for PR completion and `$letletme-release-acceptance` only for authorized release acceptance.
- Generic Next.js, React, accessibility, SEO, or design skills are opt-in for relevant work; they do not replace this repository's boundary rules.

## Verification

- Inspect `git status --short --branch` first. This repository commonly has concurrent UI WIP and multiple worktrees; preserve unrelated dirty/untracked files and avoid broad formatting or codemods.
- Use the narrowest relevant unit test first. Normal gates are `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
- Any GraphQL document or response-shape change requires `npm run contract:graphql` against the pinned GraphQL schema/module or an explicitly selected endpoint, plus the relevant server and browser path.
- Auth/database changes require matching auth tests and, when database access is available, `npm run db:migrate:status`, `npm run db:runtime-contract`, and the migration/role checks relevant to the change.
- Playwright requires an isolated `letletme_web_runtime` test database, a matching direct URL, task-owned Web/GraphQL ports, and the production-shaped standalone server configured in `playwright.config.ts`. Never reuse or kill an unowned listener.
- Keep local, preview, and production evidence separate. A production claim needs the observed `X-Letletme-Release`/origin, a representative API result, and the rendered browser path.

## Governance and review

- Global routes in `.codex/global-skills.json` are provisioned from immutable `tonglam/codex-workspace-config@7e92336ec04d38f7bb95620e304ce6ec6567c896:registry/workspace-assets.json` with its recorded SHA-256 content digest into the host Codex mount. Provision that source before invoking a route; run `python3 .codex/provision_global_skills.py --manifest .codex/global-skills.json --apply` when the host mount is absent. If provisioning or the mount is unavailable, stop and report the missing dependency rather than silently substituting it.
- Use `$gh-codex-review-loop` for PR work. A review may be skipped only after two consecutive explicit quota-limit responses for the unchanged head; record both responses and the exact SHA. This never waives CI, findings, or cleanup.
- Every P0-P3 finding must be dispositioned and its thread resolved. Only a finding confined to tests/scripts gets the time exception: implement P0/P1, and explain plus resolve P2/P3 without implementation time. P2/P3 anywhere else must be actually fixed and verified.
- Keep a complete finding ledger for the exact head; merge is prohibited while any finding is undispositioned or any review thread is unresolved. A quota override can skip only a new review request and never finding resolution.
- After merge, clean only the exact corresponding worktree, local branch, and remote branch after verifying identity; leave unrelated WIP untouched.
