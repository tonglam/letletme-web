# DNSPod regional-routing control

This directory contains the shadow-zone and acceptance material for the target
architecture:

```text
DNSPod 境内 @/CNAME/EdgeOne -> EdgeOne -> safe mainland reads on Tencent
DNSPod 境外 @/A/Vercel     -> Vercel Production
DNSPod 默认 @/A/Vercel     -> Vercel Production
```

The registrar NS is intentionally outside this repository workflow. Creating
or validating a DNSPod shadow zone does not change the live delegation. A
separate explicit approval is required before changing NS.

## Record safety

The watchdog never edits record values and never edits the default or overseas
line. It reads the exact record identified by:

- `DNSPOD_DOMAIN=letletme.top`
- `DNSPOD_EDGEONE_RECORD_ID=<integer>`
- `DNSPOD_EDGEONE_LINE=境内`
- `DNSPOD_EDGEONE_CNAME=<EdgeOne-assigned CNAME>`
- `DNSPOD_DEFAULT_VERCEL_A=<current Vercel fallback IPv4>`
- `DNSPOD_DEFAULT_VERCEL_LINE=默认`

After three consecutive EdgeOne health failures while direct Vercel is healthy,
it calls DNSPod `ModifyRecordStatus` with `DISABLE` for that one record.
DNSPod then falls back to the enabled default line according to its line
selection rules. Before disabling the regional record, the watchdog verifies
that the default line is enabled, is an apex A record, and still contains the
exact configured Vercel fallback IPv4. The watchdog does not automatically
re-enable the record.

The Cloudflare Scheduled Worker has no request route. Keep
`WATCHDOG_ENABLED=false` until the shadow zone, live line queries, complete
non-apex hostname acceptance, and the explicit NS authorization all pass.

## API credentials

Store only these as Cloudflare Worker secrets, never in `wrangler.toml` or
Git:

- `DNSPOD_SECRET_ID`
- `DNSPOD_SECRET_KEY`
- `DNSPOD_DOMAIN_ID` when the account has a stable numeric domain ID
- `DNSPOD_EDGEONE_RECORD_ID`
- `DNSPOD_EDGEONE_CNAME`
- `DNSPOD_DEFAULT_VERCEL_A`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

The DNSPod CAM identity must be limited to reading records and changing the
status of the one regional EdgeOne record. The implementation signs the
current DNSPod API 3.0 endpoints `DescribeRecordList` and
`ModifyRecordStatus`.

## Shadow-zone procedure

1. Export the current Cloudflare zone immediately before any DNS work. Do not
   use an archived August export as production truth.
2. Create the DNSPod records without changing registrar NS.
3. Run `validate-shadow-zone.mjs` against the DNSPod API export with the
   current EdgeOne CNAME and Vercel recommended A value.
4. Query the DNSPod assigned authoritative nameservers directly. Verify apex
   CNAME/A line separation, TLS, `www`, mail/TXT verification records, and
   every existing `api`, `static`, `hermes`, `pop`, and `cdn` consumer.
5. For `api`, use real GraphQL GET/POST, bot, and mini-program calls. For
   `static`, use a real R2 object URL with CORS and cache checks. For
   `hermes`, prove the Cloudflare Tunnel replacement or keep NS migration
   blocked. For `cdn`, fix the known 525 or prove it has no consumers.
6. Keep the current Cloudflare NS online until all checks pass. If any hostname
   lacks a tested equivalent, do not change NS.

## Commands

```sh
node ops/dnspod/scripts/validate-shadow-zone.mjs ./evidence/dnspod-records.json \
  --edgeone-cname '<edgeone-cname>' \
  --vercel-a '<current-vercel-recommended-a>'

npm run watchdog:dry-run
```

The validator is offline and read-only. It does not create records, alter DNS,
or call the registrar.
