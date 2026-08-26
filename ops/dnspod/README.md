# DNSPod regional-routing control

This directory contains the shadow-zone and acceptance material for the target
architecture:

```text
DNSPod 境内 @/CNAME/EdgeOne -> EdgeOne -> safe mainland reads on Tencent
DNSPod 境外 @/CNAME/Cloudflare SaaS -> Cloudflare -> Vercel Production
DNSPod 默认 @/CNAME/Cloudflare SaaS -> Cloudflare -> Vercel Production
```

The Cloudflare for SaaS route preserves the current overseas Cloudflare edge
instead of sending overseas users directly to Vercel. The validator and
watchdog retain backward compatibility with the former Vercel A-record design,
but the preferred production configuration is the exact SaaS CNAME target.

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
- `DNSPOD_DEFAULT_FALLBACK_TYPE=CNAME`
- `DNSPOD_DEFAULT_FALLBACK_VALUE=<Cloudflare-for-SaaS CNAME target>`
- `DNSPOD_DEFAULT_FALLBACK_LINE=默认`
- `FALLBACK_HEALTH_URL=<dedicated Cloudflare-for-SaaS /healthz URL>`

The watchdog checks two EdgeOne paths before resetting its failure streak: the
dedicated `eo-tencent-canary.letletme.top/healthz` safe-read path must report
`origin: tencent`, and the existing `eo-personal-canary.letletme.top` safe
GraphQL POST path must report `origin: vercel`. Both canary hostnames must be
configured with explicit EdgeOne origin rules; the Tencent rule must force the
Lighthouse origin and the Vercel rule must force the Vercel origin. This makes
the check independent of the Cloudflare Worker cron's execution geography.
After three consecutive failures of either EdgeOne path, it calls DNSPod
`ModifyRecordStatus` with `DISABLE` for that one record only if direct Vercel
and the actual Cloudflare for SaaS fallback path are both healthy and report
the same full release SHA.
DNSPod then falls back to the enabled default line according to its line
selection rules. Before disabling the regional record, the watchdog verifies
that the default line has exactly one enabled apex route and still contains the
exact configured record type and target. A missing SaaS probe, wrong
`X-Letletme-Edge` marker, stale release, competing route, or manual record drift
blocks the mutation. The watchdog does not automatically re-enable the record.

`EDGEONE_VERCEL_API_URL` is the EdgeOne canary URL for the safe
`POST /api/graphql` probe. It must remain an EdgeOne-routed URL whose rule
forces the Vercel origin; probing `VERCEL_HEALTH_URL` alone cannot detect a
broken EdgeOne-to-Vercel dynamic/API path.

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
- `DNSPOD_DEFAULT_FALLBACK_TYPE` (the preferred SaaS deployment must use the
  literal value `CNAME`)
- `DNSPOD_DEFAULT_FALLBACK_VALUE`
- `FALLBACK_HEALTH_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

`DNSPOD_EDGEONE_CNAME` is mandatory. It is a secret because the EdgeOne target
is account-specific; merely declaring the name in `wrangler.toml` is not
enough. The secret must be present in the same environment as the deployed
Worker before `WATCHDOG_ENABLED` can be enabled.

The DNSPod CAM identity must be limited to reading records and changing the
status of the one regional EdgeOne record. The implementation signs the
current DNSPod API 3.0 endpoints `DescribeRecordList` and
`ModifyRecordStatus`.

Provision the value-bearing bindings only after the shadow-zone record IDs and
targets have been captured; the commands below name the bindings without
putting any value in Git:

```sh
wrangler secret put DNSPOD_SECRET_ID --config cloudflare/watchdog/wrangler.toml
wrangler secret put DNSPOD_SECRET_KEY --config cloudflare/watchdog/wrangler.toml
wrangler secret put DNSPOD_DOMAIN_ID --config cloudflare/watchdog/wrangler.toml
wrangler secret put DNSPOD_EDGEONE_RECORD_ID --config cloudflare/watchdog/wrangler.toml
wrangler secret put DNSPOD_EDGEONE_CNAME --config cloudflare/watchdog/wrangler.toml
wrangler secret put DNSPOD_DEFAULT_FALLBACK_TYPE --config cloudflare/watchdog/wrangler.toml
wrangler secret put DNSPOD_DEFAULT_FALLBACK_VALUE --config cloudflare/watchdog/wrangler.toml
wrangler secret put FALLBACK_HEALTH_URL --config cloudflare/watchdog/wrangler.toml
wrangler secret put TELEGRAM_BOT_TOKEN --config cloudflare/watchdog/wrangler.toml
wrangler secret put TELEGRAM_CHAT_ID --config cloudflare/watchdog/wrangler.toml
wrangler deploy --config cloudflare/watchdog/wrangler.toml
wrangler secret list --config cloudflare/watchdog/wrangler.toml
```

Deploy the Worker with `WATCHDOG_ENABLED=false` first. Verify the live secret
names include `DNSPOD_EDGEONE_CNAME`, `DNSPOD_EDGEONE_RECORD_ID`,
`DNSPOD_DEFAULT_FALLBACK_TYPE`, `DNSPOD_DEFAULT_FALLBACK_VALUE`,
`FALLBACK_HEALTH_URL`, both Telegram bindings, and both DNSPod API bindings.
Enter exactly `CNAME` when Wrangler prompts for
`DNSPOD_DEFAULT_FALLBACK_TYPE`. Verify the forced Tencent/Vercel canary routes,
the actual Cloudflare SaaS fallback marker, release parity, and a read-only dry
run before enabling the watchdog; never paste secret values into a commit, log,
or review comment.

Legacy deployments may continue to provide `DNSPOD_DEFAULT_VERCEL_A` and
`DNSPOD_DEFAULT_VERCEL_LINE`; the implementation treats them as an A-record
fallback without `DNSPOD_DEFAULT_FALLBACK_TYPE`. Do not provide both legacy
and preferred bindings in a new deployment.

## Shadow-zone procedure

1. Export the current Cloudflare zone immediately before any DNS work. Do not
   use an archived August export as production truth.
2. Create the DNSPod records without changing registrar NS.
3. Run `validate-shadow-zone.mjs` against the DNSPod API export with the
   current EdgeOne CNAME, Cloudflare for SaaS CNAME target, and an exact JSON
   specification for every required non-apex host. The specification must
   include each host's intended `Name`, `Type`, `Value`, and `Line`; an enabled
   record with only a matching name is not sufficient.
4. Query the DNSPod assigned authoritative nameservers directly. Verify apex
   CNAME line separation, TLS, `www`, mail/TXT verification records, and
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
  --fallback-type CNAME \
  --fallback-value '<cloudflare-saas-cname-target>'
# Also set DNSPOD_REQUIRED_RECORDS_JSON to the exact planned route map before
# running the command; do not use a placeholder map for a cutover decision.

npm run watchdog:dry-run
```

The validator is offline and read-only. It does not create records, alter DNS,
or call the registrar.

See [`ops/cloudflare-saas/README.md`](../cloudflare-saas/README.md) for the
provider-zone canary, certificate, proxy-header, and overseas performance gates.
