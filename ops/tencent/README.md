# Tencent Web origin operations

The Tencent host is the mainland Web origin candidate. The overseas production
host continues to run GraphQL, Data, the Redis master and the bot. It must not
be stopped or migrated by these scripts. DNSPod and EdgeOne changes are handled
by a separate, fail-closed control-plane workflow.

## Required host-only files

Create these without committing them:

- `/etc/letletme/web.env` (`root:root`, `0600`) — Vercel production variables,
  plus `LETLETME_ORIGIN=tencent` and `LETLETME_LOCAL_PROXY_SECRET`.
- `/etc/letletme/origin-token` (`root:root`, `0600`) — 32 random bytes as hex;
  the same value is the Worker `ORIGIN_TOKEN` secret.
- `/etc/letletme/local-proxy-secret` (`root:root`, `0600`) — a different 32-byte
  hex secret used only between Nginx and Node.
- During a proxy-secret rotation, add
  `LETLETME_LOCAL_PROXY_SECRET_PREVIOUS` to `web.env` temporarily. It must be
  different from the active value and is removed after EdgeOne and Vercel have
  accepted the new value.
- `/etc/letletme/tls/origin.pem` and `origin-key.pem` — a publicly trusted
  certificate chain and private key for `letletme.top` (for example an ACME
  certificate), readable by Nginx. Cloudflare Origin CA material alone is not
  trusted by EdgeOne and must not be used for the Tencent-bound public path.
  Renew it before expiry, run `nginx -t`, reload Nginx, and recheck the
  EdgeOne-to-Tencent canary before accepting a new certificate.
- `/etc/letletme/release-signing-public.pem` (`root:root`, `0644`) — the
  public Ed25519 key corresponding to the GitHub Actions-only
  `TENCENT_RELEASE_SIGNING_KEY` secret. The restricted wrapper verifies the
  archive with this key and extracts it into a root-owned directory before
  staging; do not enable automation without provisioning this file.
- `CRON_SECRET` in `/etc/letletme/web.env` — a 32+ byte random bearer used
  by the local systemd timer to call `/api/cron/auth-event-cleanup`. The
  timer runs independently of authentication traffic and is installed by
  `install-host.sh`; keep this value equal only to the host's own Web secret,
  never to a client or public configuration value.

`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` must be the same 32-byte base64 value at
Vercel build time and Tencent build time. Do not put it in Git.

## EdgeOne source ACL

The manually observed EdgeOne node addresses are not a source allowlist. Use
the `EdgeOne origin ACL query` workflow with the production environment to
retrieve and validate the current IPv4/IPv6 ranges from `DescribeOriginACL`
and the scoped canary route from `DescribeL7AccRules`. The workflow is
read-only and runs those queries as independent jobs. It stores the validated
ACL and safe enable/disable route snapshots as separate short-lived artifacts;
an ACL that is not provisioned must not prevent the release-route snapshot from
being captured. It does not change EdgeOne, DNS, UFW, or application traffic.

Before applying a new list to UFW, review both `current` and `next` versions in
the artifact. Apply only the current list after confirming its version and
planned-change state, preserve the WireGuard/SSH and Cloudflare rules, and
remove only EdgeOne rules that were previously managed by the same operation.
Never replace the list with a guessed IP, a default route, or `0.0.0.0/0`.

Store the validated route snapshots as the production environment secrets
`EDGEONE_RULE_SPLIT_JSON` and `EDGEONE_RULE_ALL_VERCEL_JSON`. The exporter
accepts only the exact canary `ModifyOrigin` rule and rejects header actions,
so proxy credentials cannot enter the artifact.

The value in `/etc/letletme/local-proxy-secret` must also be configured as the
sensitive Vercel Production variable `LETLETME_LOCAL_PROXY_SECRET`. The active
public fallback uses the Cloudflare Request Transform Rule
`cf-fallback-canary-set-proxy-secret` to overwrite
`X-Letletme-Proxy-Secret` with this same value. Rotate the Vercel variable and
the active Transform Rule together; the historical Worker secret is not on the
request path.

The Tencent origin may use its own active, allow-listed Data API credential;
it does not need to copy a legacy Vercel Data key. All other shared credentials
must be fingerprint-verified against production before the first build.

Google is not directly reachable from this mainland host. This is compatible
with the routing contract only because every `/api` request, non-read method
and OAuth callback remains on Vercel. Do not route auth API traffic to Tencent.

## Host and release flow

1. Run `TENCENT_DEPLOY_PUBLIC_KEY='<deploy-public-key>' ops/tencent/scripts/install-host.sh` once as root. This installs the
   `deploy` account and a sudo allow-list for the release wrapper; it does not
   grant that account a general root shell. It also enables the daily
   `letletme-auth-event-cleanup.timer` after the host-only `CRON_SECRET` is
   provisioned. After changing release tooling,
   rerun this installer before enabling automation. The workflow checks
   `sudo /usr/local/libexec/letletme-release version` and refuses to promote
   Vercel when the installed tooling revision is stale.
2. Install the host-only files above.
3. Copy either a clean checkout with usable Git metadata, or a release archive
   containing `.letletme-release-sha`, at the exact release SHA to the host.
   A linked local worktree `.git` file is not portable.
4. Run `deploy-release.sh <checkout-or-archive> <full-sha> stage` as root (or
   call the restricted wrapper as `deploy`). It rejects a dirty or mismatched
   source, builds the exact SHA, and leaves `/opt/letletme/current` unchanged.
5. After Vercel has been promoted and returns the exact same release header,
   run `activate-release.sh <full-sha>`. It switches the current symlink
   atomically, restarts systemd, verifies `/healthz`, and renders Nginx.
   `rollback-release.sh` activates the safe `/opt/letletme/previous` release.
   The dependency install and Next.js build run as the unprivileged `letletme`
   user; root is used only for artifact installation and activation. It never
   runs a database migration.
   The Nginx-to-Node hop deliberately sends `X-Forwarded-Proto: http`: Nginx
   is the TLS terminator, while the loopback Node listener is cleartext. This
   avoids Next self-hosted Proxy/middleware attempting an HTTPS internal fetch
   to the plain listener. The public request remains HTTPS, the Host is pinned
   to `letletme.top`, and the public certificate protects both the EdgeOne path
   and the Cloudflare standby path.
6. Keep the previous release directory and its matching
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
Cloudflare Proxied apex → Cloudflare Free Transform Rules → Vercel.
The EdgeOne free-plan site is configured only as a DNS-only canary; the apex
has not changed and no watchdog is enabled. The canary origin is Vercel, not
this Tencent host.

The formal target is DNSPod mainland → EdgeOne → safe Tencent reads, while
DNSPod overseas/default → Vercel. Until the separate DNSPod PR, EdgeOne rule
snapshots, same-SHA canary, and explicit NS authorization all pass, the current
Cloudflare → Vercel production path remains unchanged. The existing
`106.52.109.82:8443` placement probe is a TCP-only probe, not a Web origin; it
must not carry application traffic.
