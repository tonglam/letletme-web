# EdgeOne / Tencent regional Web routing for `letletme.top`

## Current production state

Production is unchanged and remains:

```text
Cloudflare authoritative DNS (Proxied apex)
  -> Cloudflare free Transform Rules
  -> Vercel Production
```

There is no Cloudflare Request Worker route on the live apex. The Cloudflare
Scheduled Worker is not a request proxy; it is reserved for the DNSPod
failover watchdog and remains disabled until the shadow zone and all acceptance
gates pass. The EdgeOne canary is not a user entry point and must not be added
to Auth or OAuth trusted origins.

The free EdgeOne package is retained for testing only. No Smart Acceleration,
QUIC, add-on package, media processing, SLA, automatic paid renewal, or other
paid feature is part of this design.

This directory records the free EdgeOne canary and the conditions for a future
public cutover. The current canary still uses Vercel as its origin; the target
architecture below adds Tencent's `106.52.109.82` only for mainland safe reads.
It is not a public Web origin until the filing, TLS, same-SHA, security, and
performance gates have passed.

The DNSPod fallback implementation is included in the companion control-plane
PR, but is not deployed or enabled by this Web release. Until the watchdog
Worker and its scoped credentials have been deployed and verified to call
DNSPod `ModifyRecordStatus`, keep `WATCHDOG_ENABLED=false`; the documented
enablement sequence below remains conditional on the shadow zone, canary, and
cutover approval.

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

The formal user URL remains `https://letletme.top`. There is no `cn.` user
domain and no DNSPod NS change until a separate explicit cutover approval.
`43.163.91.9` remains the active overseas GraphQL/Data/Redis-master/bot host;
it is not stopped or migrated.

The EdgeOne site must have two tested origin paths:

- Vercel fallback/default: `vercel-origin.letletme.top:443`, with Host and TLS
  SNI `letletme.top`.
- Tencent safe-read origin: `106.52.109.82:443`, with the Tencent origin
  certificate, Host and TLS SNI `letletme.top`. This origin is only used after
  the Tencent Web release, firewall, TLS, proxy-header, and mainland feature
  tests pass.

The EdgeOne rule must require all of the following before selecting Tencent:

1. The client must be confirmed in mainland China, the method must be `GET` or
   `HEAD`, and the request must not be a WebSocket upgrade.
2. The path must not be `/api/*`, an authentication endpoint, an ACME path, or
   a Server Action request carrying `Next-Action`.
3. The request must not contain `Authorization` or a session `Cookie` that
   would make a Tencent read unsafe.
4. Reuse the existing `letletme.top` CNAME-mode EdgeOne site in the global
   area; do not create a second site.
5. Keep `eo-personal-canary.letletme.top` as the formal split canary until a
   public cutover is approved. Mainland anonymous safe reads use Tencent;
   API, unsafe methods, Server Actions, requests with session state, and
   non-mainland traffic use Vercel.
6. Store the live EdgeOne-assigned CNAME value in the
   `DNSPOD_EDGEONE_CNAME` Worker secret when preparing the watchdog; do not use
   the canary hostname as the secret value. Keep
   `WATCHDOG_ENABLED=false` while the apex remains on the fallback path.
7. Keep the canary's default origin as `vercel-origin.letletme.top`, HTTPS port
   443, origin Host `letletme.top`, and TLS SNI `letletme.top`. Configure the
   separate HTTPS Tencent safe-read origin only for the mainland allowlist.
   The Tencent origin must use a publicly trusted certificate for EdgeOne, the
   same Host and SNI contract, and the exact release SHA. The watchdog's Vercel
   API probe uses this split canary's `/api/graphql` route; it does not treat a
   safe-read response from Tencent as Vercel evidence.
8. Configure the client-IP feature to write the custom header
   `X-Letletme-Proxy-Client-IP` for every EdgeOne-to-origin request. Remove
   client-provided `X-Letletme-Origin-Token`, `X-Letletme-Client-IP`, and both
   proxy headers, then inject the EdgeOne-generated client IP and the current
   `X-Letletme-Proxy-Secret` for both Tencent-bound and Vercel-bound requests.
   For the Tencent branch additionally inject `X-Letletme-Origin-Token` with
   the separate `EDGEONE_ORIGIN_TOKEN` value matching
   `/etc/letletme/origin-token`; Nginx consumes that token before Node. The
   Vercel branch must strip the origin token. Do not delete the EdgeOne-
   generated client-IP header after enabling the client-IP feature.
9. Do not enable Edge Functions, Smart Acceleration, HTTP/3/QUIC, paid
   intelligent acceleration, add-on packages, or automatic paid upgrades.
10. Enable HTTP/2 and Brotli/Gzip. Allow WebSocket pass-through.
11. Use this cache policy:
    - bypass HTML, RSC, `/api/*`, `/healthz`, cookies, Authorization, and all
      non-GET/HEAD requests;
    - cache only `/_next/static/*` as immutable;
    - let `/_next/image` and other public files follow the origin response.
12. Add `X-Letletme-Edge: edgeone` to responses after origin fetch.

Everything else uses Vercel. If the console cannot express this rule safely,
the EdgeOne split is a failed gate and the plan stops at the current
Cloudflare/Vercel path.

## EdgeOne free configuration

Use the existing CNAME-mode site in the global area and keep the base free
package. Configure:

- free HTTPS certificate, HTTP/2, Brotli/Gzip, and WebSocket pass-through;
- no Smart Acceleration, HTTP/3/QUIC, Edge Functions, media processing,
  add-ons, or paid automatic upgrades;
- client-IP injection into `X-Letletme-Proxy-Client-IP`;
- removal of browser-supplied `X-Letletme-Origin-Token`,
  `X-Letletme-Client-IP`, and both internal proxy headers before injecting the
  trusted values;
- injection of `X-Letletme-Origin-Token` with the same private token installed
  in Tencent Nginx at `/etc/letletme/origin-token`; without this header the
  Tencent origin must reject the request;
- `X-Letletme-Proxy-Secret` set to the current application secret; and
- `X-Letletme-Edge: edgeone` on EdgeOne responses.

The cache policy is deliberately narrow:

1. Never cache non-`GET`/`HEAD`, `/api/*`, health, Auth, RSC, requests with
   Cookie/Authorization, or 4xx/5xx responses.
2. Cache only `/_next/static/*` as immutable after verifying the asset content
   and cache headers. Immutable static responses do not carry the mutable
   application `X-Letletme-Release` header; verify release parity on HTML,
   RSC, health, and API responses instead.
3. Let `/_next/image` and other public files follow the origin response until
   a separate cache test proves they are safe.
4. HTML, Server Actions, sessions, and API responses must never be EdgeOne
   HITs.

After a successful Vercel promote, Tencent activation, and split-route health
check, the production release workflow submits a scoped EdgeOne `purge_prefix`
task with the `delete` method for `/_next/static/` on the formal host and the
Vercel-origin canary. Direct deletion is intentional: immutable objects may
otherwise answer a conditional revalidation with `304` and retain stale
response metadata. The purge is part of the fail-closed release step; if it
cannot be submitted, the workflow keeps EdgeOne on the all-Vercel route.

The Tencent origin must return `X-Letletme-Origin: tencent` and the exact
release SHA. Vercel must return `X-Letletme-Origin: vercel` and the same exact
release SHA during a release transition. Public diagnostics remain:

- `GET /healthz`
- `X-Letletme-Origin: tencent|vercel`
- `X-Letletme-Release: <40-char-sha>` on runtime responses; absent on
  `/_next/static/*`
- `X-Letletme-Edge: edgeone|direct-vercel|cloudflare-fallback`

## ICP and Tencent origin gate

The public filing under account A must be verified through the authoritative
ICP query and the EdgeOne site validation; an empty “我的备案” page in
account B is not proof that `letletme.top` is unfiled. However, because this
target architecture uses Tencent Lighthouse `106.52.109.82` as an origin for
mainland traffic, the required Tencent access-filing relationship between the
filed domain, subject, and account must be proven in the current Tencent
console before public mainland traffic is served. If A cannot authorize B or
the access-filing prerequisite is unavailable, do not use the Tencent origin;
keep production on Cloudflare/Vercel.

## DNSPod shadow zone and failover

The registrar remains on its current nameservers while shadow validation runs.
The intended records are:

```text
@ / 境内 / CNAME / EdgeOne-assigned target
@ / 境外 / CNAME / Cloudflare for SaaS target
@ / 默认 / CNAME / the same Cloudflare for SaaS target
```

Create the KV namespace, then deploy the SQLite-backed Durable Object declared
in `cloudflare/watchdog/wrangler.toml`. The Durable Object serializes the
three-failure counter; the KV namespace stores only alert and audit state.
This remains within the Workers Free daily request allowance for a one-minute
cron. Store the following as Worker secrets or vars before enabling the
schedule; no DNSPod or EdgeOne secret belongs in Git:

- `DNSPOD_DOMAIN` and optional `DNSPOD_DOMAIN_ID`
- `DNSPOD_EDGEONE_RECORD_ID`, `DNSPOD_EDGEONE_CNAME`, and
  `DNSPOD_EDGEONE_LINE=境内`
- `DNSPOD_DEFAULT_FALLBACK_TYPE=CNAME`,
  `DNSPOD_DEFAULT_FALLBACK_VALUE`, and
  `DNSPOD_DEFAULT_FALLBACK_LINE=默认`
- `DNSPOD_SECRET_ID` and `DNSPOD_SECRET_KEY`, scoped only to the required
  DNSPod record read/status operations
- `EDGEONE_TENCENT_HEALTH_URL` (the isolated
  `eo-tencent-canary.letletme.top` EdgeOne route that unconditionally reaches
  Tencent, never the user apex), `EDGEONE_VERCEL_API_URL` (the existing
  `eo-personal-canary.letletme.top` route that forces the Vercel origin), and
  `VERCEL_HEALTH_URL` (direct Vercel), and `FALLBACK_HEALTH_URL` (the
  dedicated Cloudflare for SaaS path)
- `TELEGRAM_NOTIFICATION_URL` and `TELEGRAM_NOTIFICATION_API_TOKEN` for the
  existing authenticated LetLetMe notification bridge (or both
  `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`), plus
  `WATCHDOG_ENABLED`

`EDGEONE_ORIGIN_TOKEN` is not a Cloudflare Worker binding. It is provisioned
only in the EdgeOne origin-request rule for the Tencent branch and must match
the root-owned `/etc/letletme/origin-token` on the Tencent host. The rule must
also remove browser-supplied origin/proxy headers before injecting the token,
the current proxy secret, and EdgeOne's generated
`X-Letletme-Proxy-Client-IP`. Nginx forwards that exact generated header to
Node; it does not read the similarly named browser header.

The public `eo-tencent-canary.letletme.top` route is a health-only probe, not a
general Tencent origin. Its EdgeOne rule must allow only `GET` and `HEAD` for
the exact `/healthz` path and must return a non-origin `404` or `405` for every
other path or method. Denied requests must not receive the Tencent origin token
or proxy secret and must not be forwarded to Nginx. Verify this before adding
the hostname to `EDGEONE_TENCENT_HEALTH_URL`; if EdgeOne cannot express this
host-and-path deny rule, do not publish the Tencent canary hostname.

`DNSPOD_DEFAULT_FALLBACK_VALUE` is the exact enabled DNSPod default Cloudflare
for SaaS CNAME target captured before the NS change; it is not a fresh DNS
lookup performed during a failure. `DNSPOD_EDGEONE_RECORD_ID` is a different
value: it must identify the exact enabled `@ / 境内 / CNAME` record. Re-read
both IDs, lines, types, values, and statuses immediately before every
enablement. If the record identity differs from the saved values, the watchdog
alerts and makes no DNS mutation.

The safe control-plane sequence is:

1. Export the complete live Cloudflare zone and DNSPod shadow records, then
   validate every apex, mail, verification, `api`, `static`, `hermes`, `pop`,
   and `cdn` dependency without changing NS.
2. After the separate DNSPod watchdog implementation is merged, deploy it
   with `WATCHDOG_ENABLED=false`. Run `npm run watchdog:dry-run` and verify the
   deployed vars/secrets and `ModifyRecordStatus` code path without treating
   the Worker URL's 404 as a cron test; the Worker has no public request route.
3. Confirm the enabled DNSPod default Cloudflare for SaaS CNAME record and the
   disabled or shadow `境内` EdgeOne CNAME by exact record ID, line, type,
   and value.
4. Only after the full overseas hard gate, mainland split gate, and rollback
   rehearsal pass, obtain the separate explicit authorization to change the
   registrar NS to DNSPod. Keep Cloudflare authoritative and Vercel online
   throughout the mixed-NS cache period; do not cut over automatically.
5. After DNSPod is authoritative, the separate watchdog implementation is
   deployed, and real mainland/overseas probes pass, set
   `WATCHDOG_ENABLED=true` and immediately re-read the exact DNSPod records.
   The watchdog must call `ModifyRecordStatus` only after probing Tencent
   safe-read `/healthz`, the EdgeOne-to-Vercel API path, direct Vercel, and the
   actual Cloudflare for SaaS fallback path.

On three consecutive failures of either EdgeOne path while direct Vercel and
the Cloudflare for SaaS fallback path are healthy and on the same release, the
watchdog re-reads the regional and default records, disables only the exact
`DNSPOD_EDGEONE_RECORD_ID` with `ModifyRecordStatus`, verifies that no enabled
`境内` apex record remains and that the exact default fallback record is still
enabled, then sends one Telegram alert. If the records were manually changed,
duplicated, the SaaS path is stale/unhealthy, or direct Vercel is unhealthy, it
makes no DNS change and alerts instead. It never automatically re-enables the
regional record. DNSPod free-plan TTL and recursive caching make this a
minutes-scale fail-open, not a request-level failover.

For a future EdgeOne re-evaluation, the Vercel-origin canary must return
`X-Letletme-Edge: edgeone`, `X-Letletme-Origin: vercel`, and the current Vercel
release. The inactive production split must additionally prove that mainland
safe reads return `X-Letletme-Origin: tencent` with that same SHA, while the
EdgeOne API/unsafe path and all overseas/default traffic return
`X-Letletme-Origin: vercel`. The current production path must return
`X-Letletme-Edge: cloudflare-fallback` and remains the acceptance baseline.

The default record must be enabled and must be checked immediately before any
regional record is disabled. `api`, `static`, `hermes`, `pop`, `cdn`, mail,
TXT, and verification records are not copied blindly: each must have an
equivalent, tested, no-added-cost path. Any unverified Cloudflare Tunnel, R2,
GraphQL, bot, mini-program, mail, or validation dependency blocks NS change.

The watchdog runs once per minute with no public request route. It:

1. probes a dedicated EdgeOne/Tencent safe-read URL whose `/healthz` response
   must contain `origin: tencent` and `X-Letletme-Edge: edgeone`, plus a safe
   `POST /api/graphql` through an EdgeOne rule that must report
   `origin: vercel`; the second probe detects a broken EdgeOne-to-Vercel
   dynamic/API path;
2. requires three consecutive failures of either EdgeOne path while direct
   Vercel and the dedicated Cloudflare for SaaS path are healthy and report the
   same full release SHA;
3. re-reads the exact `@ / 境内 / CNAME` record and the enabled default
   Cloudflare for SaaS CNAME before mutation;
4. disables only the exact regional record using DNSPod `ModifyRecordStatus`;
5. verifies the disabled state and sends one Telegram alert; and
6. never automatically re-enables the regional record.

The watchdog must stay `WATCHDOG_ENABLED=false` until after the explicit NS
cutover and canary approval. DNSPod's minimum free-plan TTL may make failover
take several minutes; it is not request-level fail-open.

Required restricted Worker values/secrets are documented in
`ops/dnspod/README.md`. Do not place CAM keys, the EdgeOne CNAME, the Vercel
fallback address, Telegram credentials, or proxy secrets in Git.

## Acceptance gates

Before any production DNS change:

1. Read current UTC, latest `origin/main`, Vercel Production SHA, Tencent SHA,
   EdgeOne rules, DNSPod records, Cloudflare export, and all rollback IDs.
2. Prove the overseas hard gate first from Perth, Singapore, and at least one
   Europe/US runner. Compare current Cloudflare/Vercel with direct Vercel on
   dynamic pages, RSC, static chunks, image, health, and safe API POST. HTTP
   errors must stay below 0.5%; dynamic p95 and browser LCP must not worsen by
   more than 10%.
3. Prove DNSPod shadow resolution, apex TLS, all non-apex consumers, and the
   A/B filing and Tencent access-filing prerequisites without changing NS.
4. Publish the same exact SHA to Vercel and Tencent. Stage Tencent without
   changing `current`, verify the staged server in isolation, promote Vercel,
   activate Tencent atomically, and verify both `/healthz` and release headers.
5. Rotate the exposed proxy secret in two phases: accept new plus previous,
   switch EdgeOne, then remove previous and redeploy the same SHA. Logs record
   only fingerprints.
6. Test EdgeOne routing from mainland and overseas: safe reads to Tencent,
   unsafe/API/WebSocket/unknown traffic to Vercel, correct headers, no unsafe
   cache HIT, static MISS then HIT, Server Actions, Auth, uploads, and exact
   release parity.
7. Exercise watchdog failure, dual failure, manual DNS change, repeat run,
   and manual recovery without touching live NS.

Only after all gates pass may the registrar NS be changed with a separate
explicit approval. Keep the old Cloudflare path, Vercel Production, Tencent
previous release, and all rollback evidence online during the mixed-DNS
period. Observe 15 minutes, 2 hours, and 6 hours; any direct outage, 522/523/
525, unsafe cache, overseas regression, route inversion, or release drift
requires disabling the DNSPod regional record and returning all traffic to the
default Vercel path.

## Historical evidence

The prior EdgeOne-to-Vercel-only canary is not evidence for this Tencent split.
From Perth, the earlier 20-request sample measured healthz p50/p95 of Vercel
`335/638 ms` versus EdgeOne `530/1,523 ms`; homepage was `394/530 ms` versus
`556/1,528 ms`. Singapore was also slower through EdgeOne. A mainland Tencent
probe previously timed out on the Vercel-origin canary while the current
Cloudflare path returned 200. Those results explain why the current plan uses
EdgeOne only as a mainland router with a Tencent safe-read origin and keeps
overseas traffic on direct Vercel; they do not authorize an apex cutover.
