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
- Do not retain `LETLETME_LOCAL_PROXY_SECRET_PREVIOUS` in steady state. The
  temporary rotation release accepts it only when the active value is also
  configured; an orphaned secondary value is never trusted. Use the following
  fail-closed sequence, without printing either value:
  1. generate a new value and configure it as the secondary value on Vercel
     and Tencent while the existing active value remains unchanged;
  2. deploy the reviewed two-secret release to Vercel and Tencent at the same
     SHA, then prove both values independently against the trusted-host path;
  3. switch the Cloudflare Transform Rule and EdgeOne trusted-proxy header to
     the new value, then switch Tencent Nginx to the new value while the app
     still accepts both;
  4. make the new value active, remove the secondary value everywhere, and
     deploy a reviewed steady-state release that removes the compatibility
     path; verify forged and former values are rejected.
  Keep only SHA-256 fingerprints in release evidence. Any failed check leaves
  public routing on Vercel and rolls the changed injector back before the old
  value is removed.
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
  by the local systemd timers to call `/api/cron/auth-event-cleanup` and
  `/api/cron/entry-sync-outbox`. The cleanup timer runs hourly and the outbox
  delivery timer runs every minute, independently of authentication traffic.
  Both are installed by `install-host.sh`; keep this value equal only to the
  host's own Web secret, never to a client or public configuration value.

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
   grant that account a general root shell. It also enables the hourly
   `letletme-auth-event-cleanup.timer` and
   `letletme-entry-sync-outbox.timer` after the host-only `CRON_SECRET` is
   provisioned. After changing release tooling,
   rerun this installer before enabling automation. The workflow checks
   `sudo /usr/local/libexec/letletme-release version` and refuses to promote
   Vercel when the installed tooling revision is stale.
2. Install the host-only files above.
3. Build a signed prebuilt release on the existing Linux x64 CI runner, using
   Node 22 and the production host's build configuration. Clean Git checkouts
   and marker-only source archives are no longer deployable inputs. The origin
   does not install dependencies or compile Next.js. The manual procedure below
   uses the same producer and signing boundary as the workflow.
4. Upload the signed archive and call the restricted wrapper's `stage` command
   as `deploy`. It verifies the signature, exact SHA, platform, host configuration
   and required standalone/static files, leaving `/opt/letletme/current` unchanged.
   Run the wrapper's `verify <full-sha>` before activation.
5. After Vercel has been promoted and returns the exact same release header,
   run `activate-release.sh <full-sha>`. It switches the current symlink
   atomically, restarts systemd, verifies `/healthz`, and renders Nginx.
   `rollback-release.sh` activates the safe `/opt/letletme/previous` release.
   Root installs and activates the verified artifact; the application runs as
   the unprivileged `letletme` user. This flow never runs a database migration.
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

### Manual signed artifact preparation

Run on a trusted Ubuntu 24.04 Linux x64 build machine with Node 22, npm, GNU
`tar`, OpenSSL and sufficient build memory. Use the reviewed exact release SHA
and a clean checkout. `TENCENT_HOST` must resolve through the existing approved
SSH configuration as the restricted `deploy` account. Load
`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` from the approved secret store into the
process environment; it must match the installed host key. Set
`WEB_PRICE_CHANGE_LIVE_ENABLED` and `WEB_LIVE_REFRESH_PROFILE` to the approved
release values. `RELEASE_SIGNING_KEY_FILE` names the existing protected Ed25519
private key file; do not copy it to the origin or print secrets. Do not run with
shell tracing. Install reviewed host tooling before staging.

The following produces and stages an artifact only. It does not authorize or
perform a routing change or activation. Coordinate with the normal release
operator so no other release is running; keep the known rollback version.

```bash
set -euo pipefail
[[ "$RELEASE_SHA" =~ ^[a-f0-9]{40}$ ]]
[[ "$(git rev-parse HEAD)" == "$RELEASE_SHA" ]]
[[ -z "$(git status --porcelain=v1 --untracked-files=all)" ]]
[[ "$(ssh "$TENCENT_HOST" 'sudo /usr/local/libexec/letletme-release version')" == 'letletme-release-tooling 20260918-1' ]]
node ops/tencent/scripts/build-config.mjs >/dev/null
umask 077
artifact_work=$(mktemp -d)
trap 'rm -rf -- "$artifact_work"' EXIT
ssh "$TENCENT_HOST" 'sudo /usr/local/libexec/letletme-release build-config' > "$artifact_work/host.json"
git archive --format=tar "$RELEASE_SHA" > "$artifact_work/release.tar"
mkdir "$artifact_work/source"
tar -xf "$artifact_work/release.tar" -C "$artifact_work/source"
node ops/tencent/scripts/build-release.mjs "$artifact_work/source" "$RELEASE_SHA" "$artifact_work/host.json"
tar --append --file="$artifact_work/release.tar" -C "$artifact_work/source" \
  .letletme-release-sha .letletme-build.json .next/BUILD_ID \
  .next/required-server-files.json .next/standalone .next/static
gzip -c "$artifact_work/release.tar" > "$artifact_work/release.tar.gz"
openssl pkeyutl -sign -rawin -inkey "$RELEASE_SIGNING_KEY_FILE" \
  -in "$artifact_work/release.tar.gz" -out "$artifact_work/release.sig"
remote_root="/tmp/letletme-release-$RELEASE_SHA"
ssh "$TENCENT_HOST" "test ! -e '$remote_root' && test ! -e '$remote_root.tar.gz' && test ! -e '$remote_root.sig' && install -d -m 0750 '$remote_root'"
cat "$artifact_work/release.tar.gz" | ssh "$TENCENT_HOST" "install -m 0640 /dev/stdin '$remote_root.tar.gz'"
cat "$artifact_work/release.sig" | ssh "$TENCENT_HOST" "install -m 0640 /dev/stdin '$remote_root.sig'"
ssh "$TENCENT_HOST" "tar -xzf '$remote_root.tar.gz' -C '$remote_root'"
ssh "$TENCENT_HOST" "sudo /usr/local/libexec/letletme-release stage '$remote_root' '$RELEASE_SHA'"
ssh "$TENCENT_HOST" "sudo /usr/local/libexec/letletme-release verify '$RELEASE_SHA'"
```

If temporary remote paths already exist, inspect their ownership and associated
release before using the existing controlled cleanup procedure; do not overwrite
another run. A build failure or key/config mismatch stops before upload. A
signature or artifact validation failure stops before activation. Staging and
`verify` are not public production acceptance: continue the existing Vercel
promotion, matching-header, controlled activation, routing and browser/API
acceptance gates. Preserve the previous release and static files for rollback.

Next.js 16 intentionally uses an internal constant `.next/BUILD_ID` whenever
`deploymentId` is enabled. The release gate therefore checks the configured
`generateBuildId()` value, the full-SHA release header, and the built deployment
manifest. Runtime responses expose the full-SHA release header; immutable
`/_next/static/*` responses intentionally omit that mutable header and are
validated by their content hash and cache policy. For this Tencent self-hosted path, the deployment ID is the
deterministic first 32 characters of the same full Git SHA. Vercel Git builds
intentionally omit the custom ID and use Vercel's unique platform deployment
ID instead; reusing a commit-derived custom ID there would make a redeploy of
the same commit fail. The gate does not mistake the internal BUILD_ID file for
the release SHA.

For a staged Vercel CLI release, use a remote Production build with
`--skip-domain`, and pass the full commit SHA explicitly as both build-time and
runtime `LETLETME_RELEASE_SHA`. Do not use `vercel pull` plus a local
`vercel build`: Vercel intentionally returns empty placeholders for sensitive
Production variables, so that build cannot reproduce the hosted environment.
Create the unaliased candidate with `--no-wait`, then require
`vercel inspect --wait` to report a `READY` Production deployment and use
`vercel curl` to verify the protected `/healthz` endpoint. Vercel CLI 52 can
otherwise wait for an alias event that `--skip-domain` intentionally suppresses
and return a non-zero exit after a healthy candidate has already been created.
The later `vercel promote` command must pass the production `VERCEL_ORG_ID` as
its explicit `--scope`; token authentication alone defaults to the user's scope
and cannot promote a deployment owned by the team.
A Vercel Git deployment obtains the SHA from `VERCEL_GIT_COMMIT_SHA`. Builds
without either value fail before upload.

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
