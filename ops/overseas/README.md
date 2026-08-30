# Overseas origin closure for DNSPod delegation

`43.163.91.9` remains the active overseas GraphQL, Data, Redis master, bot,
and Hermes host. This procedure does not stop or migrate those services. It
only gives `hermes.letletme.top` a tested public-origin path that does not
depend on Cloudflare Tunnel after the authoritative DNS migration.

## Current Hermes constraint

The running locally managed Tunnel still uses the configuration loaded on
2026-07-16 and sends `hermes.letletme.top` directly to
`http://127.0.0.1:8642`. The on-disk `cloudflared` configuration was edited
after that process started and must not be treated as the live route or
reloaded during this migration.

The direct Nginx route in `nginx/hermes-direct.conf` preserves the same 8642
service while adding an exact virtual host, a health route, streaming-safe
proxy settings, and the existing Nginx request limit. The temporary
clear-text path requires both a current official Cloudflare source CIDR and
Cloudflare's original-HTTPS marker; browser-supplied forwarding headers alone
cannot select it. Refresh the CIDR snapshot from
`https://api.cloudflare.com/client/v4/ips` immediately before the transition.
The same source validation gates use of `CF-Connecting-IP`; the rate-limit and
forwarding identity fall back to the socket address for direct DNSPod traffic.

## Staging without traffic changes

0. Install the accepted [`letletme-vps-ops`](https://github.com/tonglam/letletme-vps-ops)
   release with its root-owned `bin/install-root.sh --expected-sha=<exact-sha>`
   entrypoint before installing this site. VPS Ops is the sole owner of the
   GraphQL blue/green selector: the installer creates the blue and green
   upstream files, `/etc/nginx/snippets/letletme-graphql-active.conf`, the
   allowlisted switch helper, and `/var/lib/letletme-graphql/active-slot`.
   The Nginx `http` block must include that active selector exactly once. On a
   fresh host, install the tracked loader under `conf.d`; on an existing host,
   retain an existing exact include and do not add a duplicate upstream:

   ```sh
   if ! sudo grep -RqsF \
     'include /etc/nginx/snippets/letletme-graphql-active.conf;' \
     /etc/nginx/nginx.conf /etc/nginx/conf.d; then
     sudo install -o root -g root -m 0644 \
       ops/overseas/nginx/letletme-graphql-active-loader.conf \
       /etc/nginx/conf.d/letletme-graphql-active-loader.conf
   fi
   ```

   Export the exact accepted GraphQL V2 release SHA. Stop before staging this
   site unless the selector identity and that selected backend both pass while
   holding the VPS Ops slot lock:

   ```sh
   export EXPECTED_GRAPHQL_SHA=<exact-accepted-v2-sha>
   sudo test -f /var/lib/letletme-graphql/switch-slot.lock
   sudo env EXPECTED_GRAPHQL_SHA="$EXPECTED_GRAPHQL_SHA" \
     flock -s /var/lib/letletme-graphql/switch-slot.lock \
     bash -eu -o pipefail -c '
       if [[ ! "$EXPECTED_GRAPHQL_SHA" =~ ^[0-9a-f]{40}$ ]]; then
         echo "EXPECTED_GRAPHQL_SHA must be exactly 40 lowercase hex characters" >&2
         exit 1
       fi
       test -L /etc/nginx/snippets/letletme-graphql-active.conf
       test -x /usr/local/sbin/letletme-graphql-switch-slot
       test -f /var/lib/letletme-graphql/active-slot
       active_slot=$(tr -d "[:space:]" < /var/lib/letletme-graphql/active-slot)
       case "$active_slot" in
         blue) active_port=4000 ;;
         green) active_port=4002 ;;
         *) echo "invalid GraphQL active-slot state" >&2; exit 1 ;;
       esac
       active_target=$(readlink -- /etc/nginx/snippets/letletme-graphql-active.conf)
       test "$active_target" = "/etc/nginx/snippets/letletme-graphql.$active_slot.conf"
       nginx -T 2>&1 | grep -q "upstream letletme_graphql_active"
       curl --fail --silent --show-error --max-time 10 \
         "http://127.0.0.1:$active_port/health/deploy" |
         python3 -c "
import json, os, sys
payload = json.load(sys.stdin)
expected = os.environ[\"EXPECTED_GRAPHQL_SHA\"]
if payload.get(\"status\") != \"ok\":
    raise SystemExit(\"selected GraphQL slot is not deploy-ready\")
if payload.get(\"contractVersion\") != \"live-points-v2\":
    raise SystemExit(\"selected GraphQL slot is not the V2 contract\")
if payload.get(\"deploySha\") != expected:
    raise SystemExit(\"selected GraphQL slot release identity does not match\")
"
     '
   ```

   Do not recreate a fixed-port upstream in this repository: that would bypass
   the atomic slot authority and could expose the retired GraphQL contract.
1. Install `nginx/letletme-client-ip.conf` under `/etc/nginx/conf.d`, then
   install `nginx/letletme-data.conf` as the canonical enabled API/Data site.
   It explicitly owns `api.letletme.top`, `pop.letletme.top`, and the default
   listeners; this prevents another site from capturing API traffic because
   of include order.
2. Install `nginx/hermes-direct.conf` as the separate
   `/etc/nginx/sites-enabled/zz-hermes-direct` site.
3. Run `nginx -t`, reload Nginx, then verify raw `/graphql` still reaches the
   GraphQL service and Web `/api/graphql` still succeeds before continuing.
   Confirm all existing containers remain healthy.
4. With live DNS still pointing at Tunnel, use `curl --resolve` against
   `43.163.91.9`. Until the certificate is expanded, use `-k` only for this
   isolated direct-origin check.
5. Compare `/health` and an unauthenticated `/v1/models` response through the
   Tunnel and through direct Nginx. Status, response shape, and authentication
   behavior must agree.

## Zero-outage certificate and route transition

Cloudflare Configuration Rules are available on the Free plan and can set the
SSL mode for one matching hostname. Destination-port override alone is not
used here because it does not define the origin connection scheme. No apex,
NS, or DNSPod production change is part of these steps.

1. Export the live `hermes` DNS record and the complete Configuration Rules
   ruleset.
2. Add a temporary Configuration Rule matching only
   `http.host eq "hermes.letletme.top"` and set SSL mode to `Flexible`.
3. Replace the Tunnel CNAME with a proxied A record to `43.163.91.9`.
   Cloudflare still terminates browser TLS while Flexible mode sends the
   origin request to the guarded port-80 branch in the staged Nginx site.
4. Verify `/health`, `/v1/models`, one authorized non-mutating model request,
   and streaming headers through the public hostname.
5. Expand the existing certificate with Certbot webroot validation:

   ```sh
   sudo certbot certonly --webroot -w /var/www/html \
     --cert-name api.letletme.top \
     -d api.letletme.top -d hermes.letletme.top -d pop.letletme.top
   ```

6. Confirm the live certificate contains all three SANs, `nginx -t`, reload,
   and verify direct strict TLS with `curl --resolve` without `-k`.
7. Disable the temporary Flexible rule, so the zone's Full (strict) mode
   applies again. Verify the public hostname now reaches Nginx over strict TLS
   and still matches the Tunnel behavior.
8. Run `certbot renew --dry-run`. The HTTP challenge remains available on
   port 80, while ordinary direct HTTP requests redirect to HTTPS.

If any check fails, restore the captured Tunnel CNAME. The running Tunnel is
left untouched until the direct route has completed its observation window.

## DNSPod shadow record

Only after the direct path and renewal test pass may the shadow zone contain:

```text
hermes / default / A / 43.163.91.9
```

The record must be queried from DNSPod's assigned authoritative servers and
tested with the same health, authentication, and streaming matrix. Registrar
NS changes still require a separate explicit `切` authorization.
