# Tencent candidate origin operations

The Tencent host is a candidate Web origin only. The overseas production host
continues to run GraphQL, Data, the Redis master and the bot. DNSPod is not part
of this routing path.

## Required host-only files

Create these without committing them:

- `/etc/letletme/web.env` (`root:root`, `0600`) — Vercel production variables,
  plus `LETLETME_ORIGIN=tencent` and `LETLETME_LOCAL_PROXY_SECRET`.
- `/etc/letletme/origin-token` (`root:root`, `0600`) — 32 random bytes as hex;
  the same value is the Worker `ORIGIN_TOKEN` secret.
- `/etc/letletme/local-proxy-secret` (`root:root`, `0600`) — a different 32-byte
  hex secret used only between Nginx and Node.
- `/etc/letletme/tls/origin.pem` and `origin-key.pem` — Cloudflare Origin CA
  material for `letletme.top`.

`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` must be the same 32-byte base64 value at
Vercel build time and Tencent build time. Do not put it in Git.

The Tencent origin may use its own active, allow-listed Data API credential;
it does not need to copy a legacy Vercel Data key. All other shared credentials
must be fingerprint-verified against production before the first build.

Google is not directly reachable from this mainland host. This is compatible
with the routing contract only because every `/api` request, non-read method
and OAuth callback remains on Vercel. Do not route auth API traffic to Tencent.

## Host and release flow

1. Run `ops/tencent/scripts/install-host.sh` once as root. This installs Git
   and OpenSSL because the release gate validates the checkout and generates a
   per-run Redis restore password.
2. Install the host-only files above.
3. Copy a clean checkout, including usable Git metadata, at the exact release
   SHA to the host. A linked local worktree `.git` file is not portable; use a
   normal clone or transfer a self-contained bundle and clone it on the host.
4. Run `deploy-release.sh <checkout> <full-sha>` as root. It rejects a dirty
   worktree or a HEAD that does not exactly match the requested SHA, then
   archives that Git commit before building. It performs `npm ci` and
   `next build`, verifies the SHA-backed deployment ID, assembles standalone
   output under `/opt/letletme/releases/<sha>`, switches
   `/opt/letletme/current` atomically, and rolls back on a failed health check.
   It never runs a database migration.
5. Keep the previous release directory until the new release has been stable
   for at least 24 hours. Hashed static assets accumulate under
   `/opt/letletme/static` so old browser documents remain loadable.

Next.js 16 intentionally uses an internal constant `.next/BUILD_ID` whenever
`deploymentId` is enabled. The release gate therefore checks the configured
`generateBuildId()` value, the full-SHA release header, and the built deployment
manifest. Vercel caps `deploymentId` at 32 characters, so the deployment ID is
the deterministic first 32 characters of the same full Git SHA. The gate does
not mistake the internal BUILD_ID file for the release SHA.

Before every later Web release, put the Worker at pass-through 100%, deploy and
verify the same SHA on Tencent and Vercel, and only then restore the CN split.
For a Vercel CLI production build, pass the full commit SHA explicitly as both
build-time and runtime `LETLETME_RELEASE_SHA`; a Vercel Git deployment obtains
the same value from `VERCEL_GIT_COMMIT_SHA`. Builds without either value fail
before upload.

## Cloudflare Worker versions

Keep two deployable versions of `letletme-router` from the same source:

```bash
release_sha=<full-40-character-git-sha>
npx wrangler versions upload --config cloudflare/worker/wrangler.toml \
  --var "ROUTER_MODE:pass-through" \
  --var "ROUTER_VERSION:pass-through-${release_sha}" \
  --var "EXPECTED_RELEASE_SHA:${release_sha}" \
  --tag "pass-through-${release_sha}"
npx wrangler versions upload --config cloudflare/worker/wrangler.toml \
  --var "ROUTER_MODE:cn-router" \
  --var "ROUTER_VERSION:cn-router-${release_sha}" \
  --var "EXPECTED_RELEASE_SHA:${release_sha}" \
  --tag "cn-router-${release_sha}"
```

Supply the remaining non-secret vars from `wrangler.toml` on both uploads and
set `ORIGIN_TOKEN` with `wrangler secret put`. The initial `wrangler deploy`
must be pass-through, so merely attaching the route cannot move traffic to
Tencent.
Configure the `letletme.top/*` route as fail-open. Promote pass-through first,
then split 90/10, 50/50 and 0/100 by version ID. A rollback is a 100%
deployment of the pass-through version.
