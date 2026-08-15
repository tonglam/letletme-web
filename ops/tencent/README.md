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

The value in `/etc/letletme/local-proxy-secret` must also be configured as the
sensitive Vercel Production variable `LETLETME_LOCAL_PROXY_SECRET`. The Worker
uses a separate Cloudflare secret named `VERCEL_PROXY_SECRET` with this same
value when it forwards requests to Vercel, allowing the Web app to preserve
the authenticated client-IP rate-limit subject across the cross-zone hop.

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
   The dependency install and Next.js build run as the unprivileged `letletme`
   user; root is used only for artifact installation and activation. It never
   runs a database migration.
   The Nginx-to-Node hop deliberately sends `X-Forwarded-Proto: http`: Nginx
   is the TLS terminator, while the loopback Node listener is cleartext. This
   avoids Next self-hosted Proxy/middleware attempting an HTTPS internal fetch
   to the plain listener. The public request remains HTTPS, the Host is pinned
   to `letletme.top`, and Cloudflare Origin CA still protects the external hop.
5. Keep the previous release directory and its matching
   `/opt/letletme/static-releases/<sha>` directory until the new release has
   been stable for at least 24 hours. After that rollback window, each
   successful deployment prunes older release, static, and Next cache
   directories while retaining the active and immediate rollback releases.
   Static assets are release-scoped; Nginx checks the active release first and
   then retained releases so in-flight browser requests for an older chunk do
   not 404 during a rollout or rollback.

Next.js 16 intentionally uses an internal constant `.next/BUILD_ID` whenever
`deploymentId` is enabled. The release gate therefore checks the configured
`generateBuildId()` value, the full-SHA release header, and the built deployment
manifest. For this Tencent self-hosted path, the deployment ID is the
deterministic first 32 characters of the same full Git SHA. Vercel Git builds
intentionally omit the custom ID and use Vercel's unique platform deployment
ID instead; reusing a commit-derived custom ID there would make a redeploy of
the same commit fail. The gate does not mistake the internal BUILD_ID file for
the release SHA.

For a Vercel CLI production build, pass the full commit SHA explicitly as both
build-time and runtime `LETLETME_RELEASE_SHA`; a Vercel Git deployment obtains
the same value from `VERCEL_GIT_COMMIT_SHA`. Builds without either value fail
before upload.

## Current public Web routing

This host is not a public Web origin. The current production path is
Cloudflare Proxied apex → `letletme-router` pass-through Worker → Vercel.
The EdgeOne free-plan site is configured only as a DNS-only canary; the apex
has not changed and no watchdog is enabled. The canary origin is Vercel, not
this Tencent host.

Do not upload a `cn-router` version, configure a Tencent route split, enable
Cloudflare placement hints, or enable the `106.52.109.82:8443` placement probe.
The old placement-probe script and historical Worker versions may remain in
Git for audit history, but they are not part of production operations. Any
future Web release must preserve the Cloudflare pass-through path and validate
any new edge candidate separately before changing DNS.
