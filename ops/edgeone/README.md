# EdgeOne zero-cost edge for `letletme.top`

## Current decision

EdgeOne was validated as a non-production candidate, but it was not accepted
for the public route. The real Perth comparison used 20 samples per path:
direct Vercel measured p50/p95 `292/550 ms`, while EdgeOne measured
`523/1,509 ms`; the p95 regression exceeded the agreed 10% limit. The
temporary `eo-canary.letletme.top` DNS record was removed after this gate
failed.

Current production remains:

```text
Cloudflare authoritative DNS (Proxied apex)
  → `letletme-router` pass-through Worker
    → Vercel Production
```

Do not create a production EdgeOne CNAME or enable the watchdog unless a new
review produces passing mainland and overseas evidence. This document keeps
the candidate configuration and rollback procedure for a future re-evaluation;
it does not assert that EdgeOne is currently serving users.

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

As of the latest review, the account's ICP console had no filing record and no
site had been created. This blocks a public cutover, not the safe
pre-production creation step; production must remain on Cloudflare
pass-through → Vercel until the gates are re-verified.

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
Proxied Vercel record and the pass-through Worker serves Vercel. It never
automatically switches back to EdgeOne.

## Required free configuration

1. Add `letletme.top` as a CNAME-mode EdgeOne site in the global area.
2. Complete the Cloudflare TXT ownership challenge.
3. Use the EdgeOne-generated CNAME target as `EDGEONE_CNAME_TARGET` in the
   watchdog. Keep the Cloudflare apex DNS record DNS-only while EdgeOne is in
   use, with TTL 60 seconds.
4. Configure the origin as `letletme-web.vercel.app`, HTTPS port 443, origin
   Host `letletme.top`, and TLS SNI `letletme.top`.
5. Configure the client-IP feature to overwrite the custom header
   `X-Letletme-Proxy-Client-IP`. Add an origin-request header rule that first
   removes client-provided `X-Letletme-Origin-Token`,
   `X-Letletme-Client-IP`, `X-Letletme-Proxy-Client-IP`, and
   `X-Letletme-Proxy-Secret`, then injects `X-Letletme-Proxy-Secret` with the
   same value as the Vercel `LETLETME_LOCAL_PROXY_SECRET`.
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
