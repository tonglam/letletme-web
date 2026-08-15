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

This directory describes the production configuration that must be created in
the Tencent Cloud console. The application remains on Vercel; Tencent's
`106.52.109.82` is not a public Web origin in this architecture.

## Gates before site creation

Do not enable any paid feature, add-on, automatic renewal, public DNS record,
or production watchdog until these pre-creation gates have current console
evidence:

1. The Tencent console must confirm that `letletme.top` is eligible for the
   selected free global area. The domain's existing personal ICP filing under
   account A is not treated as verified for account B merely from a local
   record; save the actual EdgeOne eligibility result.
2. If the origin is ever changed to Tencent Lighthouse `106.52.109.82`,
   Tencent access filing must be completed first. The approved zero-cost
   architecture keeps the origin on Vercel, so the Tencent Lighthouse access
   filing branch must not be activated accidentally.
3. The free plan must remain the base plan: no Add-on Suite, Smart
   Acceleration, HTTP/3/QUIC, media processing, SLA, or automatic paid
   renewal. The free plan's unlimited traffic/request line does not authorize
   paid feature switches.
Creating a non-public EdgeOne site for ownership and configuration validation
is allowed after these pre-creation checks, but it is not a production
cutover: do not point user DNS at it or enable the watchdog. Any site creation
in the attended Tencent console still requires explicit user authorization.

## Gates after site creation, before cutover

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

The proposed public Web path, currently inactive, is:

```text
Cloudflare authoritative DNS (DNS-only apex CNAME)
  → EdgeOne free global site
    → Vercel Production (`letletme-web.vercel.app`)
```

The active public path is the Cloudflare Proxied apex and pass-through Worker
shown in **Current decision** above.

All paths and methods, including mainland reads, remain on the same Vercel
origin. Do not add a mainland-to-Tencent split: it introduces a second
application runtime, cross-region consistency risk, and the Lighthouse access
filing requirement. `/api/*`, all non-`GET`/`HEAD` requests, WebSocket
upgrades, ACME paths, HTML/RSC, cookies, and Authorization requests must not
be EdgeOne-cached or routed to Tencent.

Cloudflare remains authoritative and DNS-only during EdgeOne service. Apex
CNAME flattening is required; do not switch NS to EdgeOne or DNSPod. If
EdgeOne fails, the watchdog restores the exact pre-cutover Cloudflare
Proxied Vercel record and the free Transform Rules serve Vercel. It never
automatically switches back to EdgeOne.

## Required free configuration

1. Add `letletme.top` as a CNAME-mode EdgeOne site in the global area.
2. Complete the Cloudflare TXT ownership challenge.
3. Use the EdgeOne-generated CNAME target as `EDGEONE_CNAME_TARGET` in the
   watchdog. Keep the Cloudflare apex DNS record DNS-only while EdgeOne is in
   use, with TTL 60 seconds.
4. Configure the origin as `letletme-web.vercel.app`, HTTPS port 443, origin
   Host `letletme.top`, and TLS SNI `letletme.top`.
5. Configure the client-IP feature to write the custom header
   `X-Letletme-Proxy-Client-IP`. Add an origin-request header rule that removes
   client-provided `X-Letletme-Origin-Token` and `X-Letletme-Client-IP`, then
   injects `X-Letletme-Proxy-Secret` with the same value as the Vercel
   `LETLETME_LOCAL_PROXY_SECRET`. Do not delete the EdgeOne-generated client-IP
   header after enabling the client-IP feature.
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

The temporary `eo-canary.letletme.top` record, if used, is only for
`curl --resolve`/canary tests. It must not be added to Auth trusted origins or
advertised as a user URL.

## Watchdog deployment values

Create the KV namespace, then deploy the SQLite-backed Durable Object declared
in `cloudflare/watchdog/wrangler.toml`. The Durable Object serializes the
three-failure counter; the KV namespace stores only alert and audit state.
This remains within the Workers Free daily request allowance for a one-minute
cron. Store the following as Worker secrets or vars before enabling the
schedule:

- `ZONE_ID`, `DNS_RECORD_ID` (the active post-cutover EdgeOne CNAME record)
- `EDGEONE_CNAME_TARGET`
- `VERCEL_FALLBACK_A` and, if needed, `VERCEL_FALLBACK_TTL`
- `CLOUDFLARE_API_TOKEN` (only Zone DNS Edit for `letletme.top`)
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

`VERCEL_FALLBACK_A` is not the current rotating address returned by
`letletme-web.vercel.app`. It must be the exact proxied apex A record exported
immediately before cutover. `DNS_RECORD_ID` is a separate value: it must
identify the active post-cutover EdgeOne CNAME record. The archived
pre-routing baseline used `76.76.21.21`; re-read and export the live
Cloudflare record before every future cutover.

If the cutover changes the record type by deleting the old A record and
creating a CNAME, Cloudflare assigns a new record ID. The safe sequence is:

1. Export the old proxied A record, its ID, and `VERCEL_FALLBACK_A` for
   rollback evidence.
2. Before changing DNS, redeploy the currently deployed watchdog with
   `WATCHDOG_ENABLED=false`; verify the deployed configuration has taken
   effect so no scheduled run can write the rollback record during cutover.
3. Delete the existing apex A record using the exported record ID, then
   confirm the apex has no conflicting A/AAAA/CNAME record.
4. Create the apex EdgeOne CNAME as DNS-only.
5. If CNAME creation or its record verification fails after step 3, stop
   immediately and recreate the exported proxied A record with the exact
   saved name, content, TTL, and `proxied=true`; GET it back and verify it is
   the fallback record. Failure to restore the A record is a hard stop for
   manual Cloudflare recovery; never enable the watchdog in this state.
6. Immediately query Cloudflare DNS and capture the new CNAME record ID;
   verify the exact apex name, EdgeOne target, and `proxied=false`.
7. Update or redeploy the watchdog with that new CNAME ID, still with
   `WATCHDOG_ENABLED=false`. Verify that value in the deployed Worker
   configuration, then run only non-mutating checks: `npm run watchdog:dry-run`
   validates the bundle, `curl -fsS https://letletme-web.vercel.app/healthz`
   validates direct Vercel, `curl -fsS https://letletme.top/healthz` validates
   the current apex, and a request to the Worker URL returning 404 confirms
   there is no public control endpoint. The 404 is not evidence that the cron
   ran; the deployed `WATCHDOG_ENABLED=false` value is the disablement check.
8. Enable the watchdog only after the direct Vercel health probe and the
   exact EdgeOne-record check both pass.

If an in-place Cloudflare update preserves the record ID, still GET the record
and verify that it is the active EdgeOne CNAME before enabling the watchdog;
the same disable-before-DNS-change sequence applies. Never leave
`DNS_RECORD_ID` set to the archived Vercel A-record ID:
`VERCEL_FALLBACK_A` is rollback content, not the watchdog's live record ID.

Set `WATCHDOG_ENABLED=true` only after the apex is the exact EdgeOne CNAME and
the direct Vercel health probe succeeds. The watchdog never returns to
EdgeOne automatically after a fallback.

## Verification commands

```sh
curl -sS -D - https://letletme.top/healthz -o /tmp/healthz.json
curl -sS -D - https://letletme-web.vercel.app/healthz -o /tmp/vercel-healthz.json
curl -sS -D - -X POST https://letletme.top/api/vitals \
  -H 'content-type: application/json' -d '{}'
```

For a future EdgeOne re-evaluation, the canary/public path must return
`X-Letletme-Edge: edgeone`, `X-Letletme-Origin: vercel`, and the current Vercel
release. The current production path must return
`X-Letletme-Edge: cloudflare-fallback` and remains the acceptance baseline.
