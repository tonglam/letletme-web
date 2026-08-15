# EdgeOne free-plan current-state refresh — 2026-08-15

This is a live-state refresh after the initial canary record. It is not an
apex cutover approval.

## Current public routing

- Observation time: `2026-08-15T20:19Z`.
- Vercel Production release observed on the apex, the EdgeOne canary, and
  direct Vercel: `dd16eba80dc68ed089e37b87359ccb1601ca54b5`.
- `letletme.top/healthz`: HTTP 200, `X-Letletme-Origin: vercel`,
  `X-Letletme-Edge: cloudflare-fallback`, `Cache-Control: no-store`, and
  `CF-Cache-Status: DYNAMIC`.
- `eo-canary.letletme.top/healthz`: HTTP 200, the same release,
  `X-Letletme-Edge: edgeone`, and `Cache-Control: no-store`.
- The Cloudflare Workers Routes API returned an empty result for the
  `letletme.top` zone. The fully loaded dashboard page also showed no routes.
  Therefore `letletme.top/* → letletme-router` is not currently attached to
  the production zone.
- Cloudflare Transform Rules currently show four active request-header rules
  for `letletme.top` (remove the two browser-controlled internal headers,
  set the client IP from `ip.src`, and set the proxy secret) and one active
  response-header rule that sets `X-Letletme-Edge: cloudflare-fallback`.

## EdgeOne decision

- The free EdgeOne site remains a canary only. The apex has not been changed.
- The canary's dynamic performance samples remain below the agreed cutover
  gate, and the earlier Force HTTPS console/live-response discrepancy remains
  an unresolved protocol gate. Do not switch the apex, enable the watchdog,
  or purchase Smart Acceleration.
- The watchdog remains disabled with `WATCHDOG_ENABLED=false`.

## Repository state clarification

- The current `origin/main` configuration has no `routes` block; route removal
  was merged in commit `3665a55309802beca312719effe1bd94ffd92482`.
- A separate stale local `main` worktree still contains the historical route
  stanza in `cloudflare/worker/wrangler.toml`. That worktree is intentionally
  left untouched because it contains unrelated user changes and must not be
  used for a Cloudflare deployment.

## Decision

Keep production on the no-request-Worker path:

```text
Cloudflare Proxied apex → Transform Rules → Vercel Production
```

Keep `eo-canary.letletme.top` for further measurement only. No production DNS,
request Worker route, Vercel deployment, EdgeOne paid feature, or overseas
service was changed by this refresh.
