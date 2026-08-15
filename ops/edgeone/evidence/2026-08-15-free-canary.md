# EdgeOne free canary evidence — 2026-08-15

This record captures the attended validation of the free EdgeOne canary. It is
evidence for the decision to keep the public apex on the no-request-Worker
Cloudflare fallback; it is not a cutover approval.

## State at capture

- Capture window: `2026-08-15T19:40Z`–`19:55Z`.
- Web release observed on Vercel, the apex, and EdgeOne canary:
  `3665a55309802beca312719effe1bd94ffd92482`.
- Public apex: Cloudflare authoritative DNS, Proxied, with four request-header
  Transform Rules and one response-header Transform Rule; Workers Routes has
  no configured route.
- Public path: Cloudflare fallback → Vercel.
- Canary: `eo-canary.letletme.top` DNS-only CNAME → EdgeOne site
  `zone-3tt53u82mu1u` → Vercel origin `letletme-web.vercel.app`.
- EdgeOne console: global area, CNAME mode, enabled, base `免费版`; no paid
  Smart Acceleration, QUIC, add-on, or automatic paid feature was enabled.
- Watchdog: `WATCHDOG_ENABLED=false`; no apex DNS mutation was made.

## Functional and cache checks

All checks below returned the current release and HTTP 200 unless noted.

- Apex `/healthz`: `X-Letletme-Edge: cloudflare-fallback`, `no-store`,
  `cf-cache-status: DYNAMIC`.
- Direct Vercel `/healthz`: `no-store`.
- EdgeOne canary `/healthz`: `X-Letletme-Edge: edgeone`, `no-store`,
  `eo-cache-status: MISS`.
- Apex GraphQL POST `{__typename}` with forged internal proxy headers: 200,
  `no-store`, fallback marker; forged headers did not control the request.
- `/_next/static/*`: immutable cache headers and Cloudflare HIT.
- `www.letletme.top`: 308 to `https://letletme.top/`.

## Performance evidence

Each row is 20 requests; values are TTFB in milliseconds. The representative
dynamic-page gates require a meaningful mainland improvement and no material
overseas regression.

| Location/path | Vercel p50/p95 | EdgeOne p50/p95 | Result |
| --- | ---: | ---: | --- |
| Perth `/healthz` | 460.7 / 2381.0 | 526.1 / 880.9 | p50 no improvement |
| Perth `/` | 507.3 / 1056.9 | 555.9 / 1559.5 | failed |
| Singapore `/healthz` | 89.9 / 132.9 | 244.1 / 1147.7 | failed |
| Singapore `/` | 111.5 / 177.6 | 135.9 / 1136.6 | failed |

The canary also showed a console Force HTTPS setting as enabled while a live
HTTP request still returned 200 without a `Location` header. This remains a
separate protocol gate failure. The EdgeOne canary therefore does not qualify
for apex cutover or for the paid intelligent-acceleration decision.

## Host safety checks

- `43.163.91.9`: GraphQL, Data API, Data worker, and WeChat bot containers were
  healthy; Redis 6379 was not publicly reachable.
- WireGuard on the overseas host had a current peer handshake and could reach
  `10.77.0.2` over the tunnel.
- `106.52.109.82`: public 22, 80, 443, and 6379 were filtered; 8443 returned
  only the existing `letletme-placement-probe` banner and was not used as a
  Web origin.
- The Tencent Redis replica's internal `master_link_status` was not read in
  this window because the Tencent console terminal required account MFA.

## Decision and remaining gates

Keep production on Cloudflare fallback → Vercel. Do not change apex DNS, do
not enable the watchdog, and do not purchase paid acceleration. Continue the
24-hour stability observation. Before final acceptance, obtain a read-only
Redis replica status from the Tencent host and complete the planned hardening
review for the existing 8443 probes.
