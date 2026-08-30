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
1. Deploy the accepted Web release before activating this ingress. The Web
   `/api/graphql` route must remain in front of GraphQL because it creates the
   signed ingress envelope. In production, both that route and RSC reads use
   `https://api.letletme.top/graphql`; absent or fixed `4000`/`4002`
   `GRAPHQL_ENDPOINT` values are normalized to this canonical active-selector
   URL.
2. From the accepted Web checkout, export the exact Web and GraphQL V2 SHAs and
   run the tracked activation command. It acquires the VPS Ops slot lock
   exclusively before inspecting the selector and does not release it until
   after file installation, `nginx -t`, reload, direct readiness, exact Web
   `/healthz` identity, and the post-reload Web `/api/graphql` V2 probe:

   ```sh
   export EXPECTED_GRAPHQL_SHA=<exact-accepted-v2-sha>
   export EXPECTED_WEB_SHA=<exact-accepted-web-sha>
   sudo env EXPECTED_GRAPHQL_SHA="$EXPECTED_GRAPHQL_SHA" \
     EXPECTED_WEB_SHA="$EXPECTED_WEB_SHA" \
     ops/overseas/activate-api-ingress.sh
   ```

   The command reads `nginx -T` to count the selector include across every
   effective Nginx include path, including `sites-enabled`; it installs the
   tracked `conf.d` loader only when the count is zero and rejects duplicates.
   It also parses the selected upstream file and requires its actual endpoint
   to equal `127.0.0.1:4000` for blue or `127.0.0.1:4002` for green before any
   reload. Do not recreate a fixed-port Web or Nginx upstream: that bypasses
   atomic slot authority and can expose the retired GraphQL contract.

3. Confirm all existing containers remain healthy. The activation command
   proves the canonical API/Data site, Hermes site, and selector atomically; do
   not repeat their installation or reload Nginx outside its lock.
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
