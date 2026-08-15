# EdgeOne zero-cost edge for `letletme.top`

This directory describes the production configuration that must be created in
the Tencent Cloud console. The application remains on Vercel; Tencent's
`106.52.109.82` is not a public Web origin in this architecture.

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
