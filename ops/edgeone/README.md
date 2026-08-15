# EdgeOne zero-cost edge for `letletme.top`

This directory describes the production configuration that must be created in
the Tencent Cloud console. The application remains on Vercel; Tencent's
`106.52.109.82` is not a public Web origin in this architecture.

## Hard gates before creating the site

Do not create the site, accept EdgeOne service terms, add a CNAME, or enable
the watchdog until all of these gates have current console evidence:

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
4. The EdgeOne console must expose and pass the required origin, TLS, client
   IP, WebSocket, header, and cache checks below. A feature that is merely
   documented but unavailable in this account is a failed gate.

As of the latest review, the account's ICP console had no filing record and no
site had been created. This is a cutover blocker; production must remain on
Cloudflare pass-through → Vercel until the gates are re-verified.

## Routing contract

The only approved public Web path is:

```text
Cloudflare authoritative DNS (DNS-only apex CNAME)
  → EdgeOne free global site
    → Vercel Production (`letletme-web.vercel.app`)
```

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

- `ZONE_ID`, `DNS_RECORD_ID`
- `EDGEONE_CNAME_TARGET`
- `VERCEL_FALLBACK_A` and, if needed, `VERCEL_FALLBACK_TTL`
- `CLOUDFLARE_API_TOKEN` (only Zone DNS Edit for `letletme.top`)
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

`VERCEL_FALLBACK_A` is not the current rotating address returned by
`letletme-web.vercel.app`. It must be the exact proxied apex A record exported
immediately before cutover, and `DNS_RECORD_ID` must identify that exact
record. The archived pre-routing baseline used `76.76.21.21`; re-read and
export the live Cloudflare record before every future cutover.

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

The public path must return `X-Letletme-Edge: edgeone`,
`X-Letletme-Origin: vercel`, and the current Vercel release. The Cloudflare
fallback path returns `X-Letletme-Edge: cloudflare-fallback`.
