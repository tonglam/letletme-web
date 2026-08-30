---
name: letletme-web-request-path
description: Trace or change a LetLetMe Web page, API route, authentication flow, GraphQL operation, or browser/RSC data path. Use for feature work and bugs inside letletme-web; escalate to the cross-repository stack skill when producer or GraphQL contracts must change.
---

# LetLetMe Web request path

## Establish scope

1. Inspect the current branch, worktrees, and dirty/untracked files. Preserve unrelated work.
2. Name the user-visible route, request class, and evidence target: RSC render, browser interaction, API route, auth flow, or deployed behavior.
3. Keep the task Web-only if Web can satisfy it without changing a producer, GraphQL schema/resolver, Mini contract, or deployment topology. Otherwise invoke `$letletme-stack-audit` and register the affected repositories; do not invent a Change ID for a single-repository change.

## Trace before editing

Follow the narrow path that applies:

- Page: `app/[locale]/.../page.tsx` -> imported implementation under `app/data`, `app/live`, `app/me`, or `app/tournament` -> components/hooks -> GraphQL operation or Web API route.
- Browser GraphQL: component/hook -> `lib/graphql-client.ts` -> `/api/graphql` -> proxy security/session/ingress helpers -> GraphQL.
- RSC GraphQL: localized page/server helper -> `lib/graphql-server.ts` -> signed service/ingress and optional user context -> GraphQL.
- Web API: `app/api/**/route.ts` -> request guards/session -> Web-owned service/DB or an existing upstream client -> bounded response.
- Auth: `proxy.ts` plus the authoritative page/handler check -> `lib/auth.ts`/session helpers -> `bauth` through `lib/db`.

Read only the relevant source plus:

- `docs/auth.md` for auth, binding, Mini sessions, `bauth`, ingress, or authorization.
- `playwright.config.ts` for browser/server test topology.
- `next.config.js` for standalone output, release identity, security headers, image runtime, or deployment behavior.
- `.github/graphql-contract-ref` and `scripts/validate-queries-vs-schema.ts` for GraphQL document compatibility.

## Preserve contracts

- Keep browser requests origin-relative; keep private endpoints and credentials server-only.
- Reuse existing request/session/ingress/cache helpers. Do not hand-roll identity headers or trust browser-supplied user/entry fields.
- Keep route authorization in the handler/RSC even when `proxy.ts` also guards the route.
- Keep locale shells, metadata, translations, server seeds, client refresh state, empty/updating/error states, and responsive behavior coherent.
- Treat Data/GraphQL values as authoritative. Web may present and combine contract fields but must not create a second business-rule implementation unless explicitly owned here.
- For `bauth`, append migrations through the existing Drizzle history and direct runner; do not mutate applied history.

## Verify the changed path

1. Run the narrowest relevant unit test and type/lint check for touched code.
2. For GraphQL documents, run `npm run contract:graphql` against the pinned schema/module or explicitly chosen endpoint.
3. For browser behavior, use `$letletme-web-dev-environment`; run the narrowest Playwright spec with isolated database and ports.
4. For auth/database changes, include fresh-session, route-handler, migration-history, runtime-role, and negative authorization cases relevant to the change.
5. Report source/test/local-browser/deployed evidence separately. Health alone is not rendered-path acceptance.
