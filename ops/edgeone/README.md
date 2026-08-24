# EdgeOne zero-cost edge for `letletme.top`

## Current decision

The site and free-plan canary are now configured, but production has not been
cut over. The canary is `eo-canary.letletme.top` →
`eo-canary.letletme.top.eo.dnse1.com` (DNS-only), using EdgeOne site
`zone-3tt53u82mu1u` and Vercel origin `letletme-web.vercel.app`. Live
`/healthz` and GraphQL POST checks returned 200 with the current Vercel
release and `X-Letletme-Edge: edgeone`; `/_next/static/*` returned MISS then
HIT. The apex remains unchanged while mainland and overseas performance and
feature gates are collected.

The first completed overseas sample (20 requests per path) does not pass the
cutover gate. From Perth, healthz TTFB p50/p95 was Vercel `335/638 ms` versus
EdgeOne `530/1,523 ms`; homepage was Vercel `394/530 ms` versus EdgeOne
`556/1,528 ms`. From the Singapore production host, healthz was Vercel
`88/334 ms` versus EdgeOne `239/1,242 ms`; homepage was Vercel `118/168 ms`
versus EdgeOne `263/1,274 ms`. Static content improved only in Singapore and
regressed in Perth, so the static-only fallback is not yet justified either.
These results keep the apex on the current Cloudflare path.

The console also displayed the free-plan Force HTTPS setting as enabled with a
302 redirect, but a repeated HTTP request to the live canary still returned
200 without a `Location` header. Until that discrepancy is resolved, HTTPS
redirect behavior is a separate canary blocker and is not acceptable for an
apex cutover.

Current production remains:

```text
Cloudflare authoritative DNS (Proxied apex)
  → Cloudflare Free Request/Response Transform Rules
    → Vercel Production
```

Cloudflare Workers Routes currently has no route for `letletme.top`; the
pass-through Worker is retained only as historical, tested rollback code and
is not on the request path. The live apex returns the fallback marker from the
Response Transform Rule and the request Transform Rules provide the trusted
client-IP and proxy-secret headers.

Do not change the apex or enable the watchdog until the complete mainland and
overseas review produces passing evidence. The canary is not a user URL and
must not be added to Auth trusted origins.

This directory records the free EdgeOne canary and the conditions for a future
public cutover. The current canary still uses Vercel as its origin; the target
architecture below adds Tencent's `106.52.109.82` only for mainland safe reads.
It is not a public Web origin until the filing, TLS, same-SHA, security, and
performance gates have passed.

The DNSPod fallback implementation is a separate control-plane change and is
not installed or enabled by this Web release PR. Until the watchdog source and
deployed Worker have been verified to call DNSPod `ModifyRecordStatus`, keep
`WATCHDOG_ENABLED=false`; the documented enablement sequence below is
conditional on that separate implementation being merged, tested, and
deployed.

## Gates before public cutover

Do not enable any paid feature, add-on, automatic renewal, apex DNS change, or
production watchdog until these cutover gates have current console evidence:

1. The Tencent console currently shows `letletme.top` enabled in CNAME mode,
   global area, and the base `免费版`. The console accepted the domain; the
   public apex is still not pointed at it.
2. The current Vercel-origin canary does not activate Tencent Lighthouse
   access filing. The target mainland safe-read origin is Tencent Lighthouse
   `106.52.109.82`, so its access-filing relationship, certificate, and
   console approval must be proven before that origin receives public traffic.
3. The free plan must remain the base plan: no Add-on Suite, Smart
   Acceleration, HTTP/3/QUIC, media processing, SLA, or automatic paid
   renewal. The free plan's unlimited traffic/request line does not authorize
   paid feature switches.
The site and free package are already provisioned. Do not point user DNS at
the EdgeOne site or enable the watchdog unless every post-canary gate below
passes and a new cutover is explicitly approved.

## Gates after canary configuration, before cutover

After the site exists, configure and test the required origin, TLS, client IP,
WebSocket, header, and cache controls below. A feature that is merely
documented but unavailable in this account is a failed gate. Do not switch
DNS or set `WATCHDOG_ENABLED=true` until every post-creation check passes.

The account's local ICP page is not the source of truth for the existing
public filing under account A. EdgeOne's live domain validation accepted
`letletme.top`, and the configured origin is Vercel rather than Tencent
Lighthouse, so the Tencent Lighthouse access-filing branch is not activated.
The public cutover remains gated on the final console and network checks.

## Routing contract

The active public path remains the Cloudflare Proxied apex followed by the free
Request/Response Transform Rules shown in **Current decision** above. The target
path is intentionally inactive until the separate DNSPod and canary gates pass:

```text
DNSPod authoritative DNS
  ├─ 境内 → EdgeOne free global site
  │          ├─ mainland safe GET/HEAD reads → Tencent Web 106.52.109.82
  │          └─ API, Server Actions, uploads, WebSocket and unsafe/uncertain
  │             requests → Vercel Production
  └─ 境外/默认 → Vercel Production
```

The EdgeOne rule must route only a conservative safe-read allowlist to
Tencent. `/api/*`, all non-`GET`/`HEAD` requests, `Next-Action`, WebSocket
upgrades, ACME paths, requests with Cookie/Authorization, and unknown traffic
remain on Vercel. HTML/RSC safety and cache behavior are acceptance gates, not
assumptions. The EdgeOne canary's current Vercel origin validates the proxy
path; the production split rule must additionally prove the Tencent origin.

The target rollback is DNSPod-only: after three consecutive EdgeOne/Tencent
failures while direct Vercel is healthy, the Cloudflare Scheduled Worker
disables the exact DNSPod `境内` record. Mainland resolution then falls back to
the enabled DNSPod default Vercel record. It does not proxy user requests and
does not automatically re-enable the regional record. Cloudflare remains an
exported standby and manual recovery path; it is not the normal target
authority. The watchdog remains disabled while the current apex is on the
Cloudflare fallback path.

## Required free configuration for a future cutover

1. Reuse the existing `letletme.top` CNAME-mode EdgeOne site in the global
   area; do not create a second site.
2. Keep the existing EdgeOne-generated CNAME target on
   `eo-canary.letletme.top` until a public cutover is approved.
3. Use that target as `EDGEONE_CNAME_TARGET` only when preparing the watchdog.
   Keep `WATCHDOG_ENABLED=false` while the apex remains on the fallback path.
4. Keep the canary origin as `letletme-web.vercel.app`, HTTPS port 443, origin
   Host `letletme.top`, and TLS SNI `letletme.top`. For the inactive production
   split, configure a separate HTTPS Tencent safe-read origin for the mainland
   allowlist and retain the Vercel origin for dynamic/API traffic. The Tencent
   origin must use a publicly trusted certificate for EdgeOne, the same Host
   and SNI contract, and the exact release SHA; do not substitute the current
   Vercel-only canary as evidence for the Tencent path.
5. Configure the client-IP feature to write the custom header
   `X-Letletme-Proxy-Client-IP`. For Tencent-bound requests, remove
   client-provided `X-Letletme-Origin-Token`, `X-Letletme-Client-IP`, and both
   proxy headers, then inject `X-Letletme-Origin-Token` with the separate
   `EDGEONE_ORIGIN_TOKEN` value matching `/etc/letletme/origin-token` and
   inject `X-Letletme-Proxy-Secret` with the current
   `LETLETME_LOCAL_PROXY_SECRET`. Nginx consumes the origin token before Node;
   Vercel-bound requests must strip it. Do not delete the EdgeOne-generated
   client-IP header after enabling the client-IP feature.
6. Do not enable Edge Functions, Smart Acceleration, HTTP/3/QUIC, paid
   intelligent acceleration, add-on packages, or automatic paid upgrades.
7. Enable HTTP/2 and Brotli/Gzip. Allow WebSocket pass-through.
8. Use this cache policy:
   - bypass HTML, RSC, `/api/*`, `/healthz`, cookies, Authorization, and all
     non-GET/HEAD requests;
   - cache only `/_next/static/*` as immutable;
   - let `/_next/image` and other public files follow the origin response.
9. Add `X-Letletme-Edge: edgeone` to responses after origin fetch.

EdgeOne is an external reverse proxy in front of Vercel. The custom
`X-Letletme-Proxy-Client-IP` plus secret protects the application's own
trusted-IP branch, but it does not make EdgeOne a Vercel Verified Proxy
provider or restore Vercel Firewall/BotID visibility. Treat Vercel firewall
visibility, rate-limit identity, bot handling, Server Actions, streaming,
WebSocket, and authentication as explicit acceptance tests. The origin Host
and TLS SNI must both remain `letletme.top`; Vercel's ACME challenge paths
must remain reachable during certificate renewal.

The existing `eo-canary.letletme.top` record is only for `curl --resolve` and
canary tests. It must not be added to Auth trusted origins or advertised as a
user URL.

## Watchdog deployment values

Create the KV namespace, then deploy the SQLite-backed Durable Object declared
in `cloudflare/watchdog/wrangler.toml`. The Durable Object serializes the
three-failure counter; the KV namespace stores only alert and audit state.
This remains within the Workers Free daily request allowance for a one-minute
cron. Store the following as Worker secrets or vars before enabling the
schedule; no DNSPod or EdgeOne secret belongs in Git:

- `DNSPOD_DOMAIN` and optional `DNSPOD_DOMAIN_ID`
- `DNSPOD_EDGEONE_RECORD_ID`, `DNSPOD_EDGEONE_CNAME`, and
  `DNSPOD_EDGEONE_LINE=境内`
- `DNSPOD_DEFAULT_VERCEL_A` and `DNSPOD_DEFAULT_VERCEL_LINE=默认`
- `DNSPOD_SECRET_ID` and `DNSPOD_SECRET_KEY`, scoped only to the required
  DNSPod record read/status operations
- `EDGEONE_ORIGIN_TOKEN`, matching the Tencent host's origin-token file and
  never the proxy secret
- `EDGEONE_HEALTH_URL` (Tencent safe-read `/healthz`),
  `EDGEONE_VERCEL_API_URL` (safe API probe through the EdgeOne Vercel rule),
  and `VERCEL_HEALTH_URL` (direct Vercel)
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and `WATCHDOG_ENABLED`

`DNSPOD_DEFAULT_VERCEL_A` is the exact enabled DNSPod default A record captured
from the live Vercel project before the NS change; it is not a fresh DNS lookup
performed during a failure. `DNSPOD_EDGEONE_RECORD_ID` is a different value: it
must identify the exact enabled `@ / 境内 / CNAME` record. Re-read both IDs,
lines, values, and statuses immediately before every enablement. If the record
identity differs from the saved values, the watchdog alerts and makes no DNS
mutation.

The safe control-plane sequence is:

1. Export the complete live Cloudflare zone and DNSPod shadow records, then
   validate every apex, mail, verification, `api`, `static`, `hermes`, `pop`,
   and `cdn` dependency without changing NS.
2. After the separate DNSPod watchdog implementation is merged, deploy it
   with `WATCHDOG_ENABLED=false`. Run `npm run watchdog:dry-run` and verify the
   deployed vars/secrets and `ModifyRecordStatus` code path without treating
   the Worker URL's 404 as a cron test; the Worker has no public request route.
3. Confirm the enabled DNSPod default Vercel A record and the disabled or
   shadow `境内` EdgeOne CNAME by exact record ID, line, type, and value.
4. Only after the full overseas hard gate, mainland split gate, and rollback
   rehearsal pass, obtain the separate explicit authorization to change the
   registrar NS to DNSPod. Keep Cloudflare authoritative and Vercel online
   throughout the mixed-NS cache period; do not cut over automatically.
5. After DNSPod is authoritative, the separate watchdog implementation is
   deployed, and real mainland/overseas probes pass, set
   `WATCHDOG_ENABLED=true` and immediately re-read the exact DNSPod records.
   The watchdog must call `ModifyRecordStatus` only after probing Tencent
   safe-read `/healthz`, the EdgeOne-to-Vercel API path, and direct Vercel.

On three consecutive failures of either EdgeOne path while direct Vercel is
healthy, the watchdog re-reads the regional and default records, disables only
the exact `DNSPOD_EDGEONE_RECORD_ID` with `ModifyRecordStatus`, verifies that no
enabled `境内` apex record remains and that the default Vercel record is still
enabled, then sends one Telegram alert. If the records were manually changed,
duplicated, or DNSPod and Vercel are both unhealthy, it makes no DNS change and
alerts instead. It never automatically re-enables the regional record. DNSPod
free-plan TTL and recursive caching make this a minutes-scale fail-open, not a
request-level failover.

## Verification commands

```sh
curl -sS -D - https://letletme.top/healthz -o /tmp/healthz.json
curl -sS -D - https://letletme-web.vercel.app/healthz -o /tmp/vercel-healthz.json
curl -sS -D - -X POST https://letletme.top/api/vitals \
  -H 'content-type: application/json' -d '{}'
```

For a future EdgeOne re-evaluation, the Vercel-origin canary must return
`X-Letletme-Edge: edgeone`, `X-Letletme-Origin: vercel`, and the current Vercel
release. The inactive production split must additionally prove that mainland
safe reads return `X-Letletme-Origin: tencent` with that same SHA, while the
EdgeOne API/unsafe path and all overseas/default traffic return
`X-Letletme-Origin: vercel`. The current production path must return
`X-Letletme-Edge: cloudflare-fallback` and remains the acceptance baseline.

The latest live-state refresh is recorded in
`evidence/2026-08-15-current-state.md`. It confirms that the production zone
has no Workers Route and that the free canary remains below the cutover gate.

The mainland probe is recorded in `evidence/2026-08-15-mainland-probe.md`.
From a Tencent mainland source, the EdgeOne canary timed out on all three
bounded `/healthz` attempts while the current Cloudflare fallback returned
HTTP 200. This is a functional blocker for the free-plan cutover, independent
of the separate overseas performance failure.
