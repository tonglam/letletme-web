# EdgeOne free-plan final observation — 2026-08-15

This record closes the current free-plan evaluation without changing public
traffic. It is a decision record, not an apex cutover approval.

## Live release and routing

- Observation time for the local probes: `2026-08-15T21:15Z`.
- The apex, EdgeOne canary, and direct Vercel all reported release
  `dd16eba80dc68ed089e37b87359ccb1601ca54b5`.
- The apex `/healthz` and GraphQL POST returned HTTP 200 with
  `X-Letletme-Edge: cloudflare-fallback`, `X-Letletme-Origin: vercel`,
  `Cache-Control: no-store`, and `CF-Cache-Status: DYNAMIC`.
- The EdgeOne canary `/healthz` returned HTTP 200 with
  `X-Letletme-Edge: edgeone` and the same release.
- The Cloudflare Workers Routes API returned an empty list for the only
  active `letletme.top` zone. No `letletme.top/*` route is attached to the
  production zone.
- Vercel production error-log query for the previous hour returned no log
  records.

## Current performance gate

Each row contains 20 sequential requests from the Perth-side execution path.
Values are time to first byte in milliseconds.

| Path | Direct Vercel p50/p95 | EdgeOne p50/p95 | Result |
| --- | ---: | ---: | --- |
| `/healthz` | 435.4 / 573.2 | 524.0 / 1553.4 | failed |
| `/` | 489.2 / 1513.8 | 592.5 / 1656.6 | failed |

EdgeOne is approximately 20% slower at p50 for both representative paths;
it does not meet the required dynamic improvement gate or the overseas
regression gate. Mainland probes were not available from this execution
environment, but the overseas failure alone blocks a public cutover.

## Existing production safety

- On `43.163.91.9`, all four existing containers were healthy: GraphQL, Data
  API, Data worker, and WeChat bot.
- The active Redis master reported `connected_slaves:1` with replica
  `10.77.0.2:6379`, `state=online`, and `lag=0`.
- The overseas host had `wg0` active at `10.77.0.1/30`; the Redis replication
  path confirms the WireGuard-connected replica is reachable.
- Public probes found Tencent `22/80/443/6379` filtered and only the existing
  `8443` placement-probe port open. Overseas `6379` remained unreachable and
  its existing `8443` service was not changed.

## Decision

Keep the no-added-cost production path:

```text
Cloudflare Proxied apex → Transform Rules → Vercel Production
```

Do not switch the apex to EdgeOne, enable the watchdog, expose Tencent as a
Web origin, stop or migrate the overseas services, or purchase Smart
Acceleration. The free EdgeOne site remains a non-production canary for a
future re-evaluation.
