# Cloudflare for SaaS overseas gateway canary

This runbook covers the zero-added-cost candidate that keeps overseas traffic
on Cloudflare while DNSPod sends mainland traffic to EdgeOne/Tencent:

```text
DNSPod 境内 @ CNAME -> EdgeOne -> Tencent safe reads / Vercel unsafe requests
DNSPod 境外 @ CNAME -> Cloudflare for SaaS -> Vercel
DNSPod 默认 @ CNAME -> Cloudflare for SaaS -> Vercel
```

The provider-zone candidate is `qitonglan.com`, separate from the customer
hostname `letletme.top`. Cloudflare for SaaS is not enabled by repository code,
and this runbook does not authorize enrollment, payment-information changes,
custom-hostname creation, production DNS changes, or NS changes.

## Cost and activation gate

Cloudflare currently lists Cloudflare for SaaS as available on Free zones with
100 custom hostnames included and a charge for additional hostnames. Pending
hostnames count toward usage, and the quota is a soft limit. Non-Enterprise
enrollment requires payment information even when usage remains inside the
included allocation.

Therefore:

- enable the product only after explicit action-time approval;
- create exactly one production custom hostname, `letletme.top`;
- do not create a wildcard hostname;
- read the quota before and after creation and require `used <= allocated`;
- stop before creating any hostname that would exceed the included allocation;
- do not enable Argo, paid WAF features, Workers, or another add-on on the SaaS
  provider zone.

References: [plans](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/),
[quotas and billing](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/quotas-and-billing/),
[enablement](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/enable/).

## Provider-zone setup

After approval, configure the isolated provider zone in this order:

1. Create a proxied CNAME such as `saas-origin.qitonglan.com` pointing to the
   current Vercel production origin (`letletme-web.vercel.app`). Designate this
   proxied record as the SaaS fallback origin and wait for `Active`.
2. Create a proxied friendly CNAME such as `saas-gateway.qitonglan.com` pointing
   to `saas-origin.qitonglan.com`. This is the only target DNSPod may use for
   the overseas and default apex lines.
3. Apply the provider-zone security, cache, and transform rules below before
   adding the custom hostname.
4. Add the exact custom hostname `letletme.top`, minimum TLS 1.2, no wildcard,
   and TXT certificate validation.
5. Pre-validate hostname ownership and pre-issue the certificate while the
   current Cloudflare production route remains unchanged. Require both
   hostname status and certificate status to be `active`.
6. Configure Delegated DCV only after checking for conflicting
   `_acme-challenge.letletme.top` TXT records. Keep its CNAME permanently so
   renewals remain automatic.

Cloudflare requires a proxied fallback-origin record and recommends a separate
CNAME target. It preserves the browser's Host header and uses the custom
hostname as fallback-origin SNI, so Vercel receives `letletme.top` rather than
the provider-zone hostname. References:
[configuration](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/getting-started/),
[connection details](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/reference/connection-details/),
[Delegated DCV](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/security/certificate-management/issue-and-validate/validate-certificates/delegated-dcv/).

## Request and response rules

The SaaS provider zone must reproduce the trusted-proxy contract without a
Request Worker:

- remove browser-provided `X-Letletme-Origin-Token` and
  `X-Letletme-Client-IP`;
- overwrite browser-provided `X-Letletme-Proxy-Client-IP` with `ip.src`;
- overwrite browser-provided `X-Letletme-Proxy-Secret` with the current rotated
  proxy secret;
- add `X-Letletme-Edge: cloudflare-fallback` to responses;
- never put the proxy-secret value in Git, screenshots, logs, PR text, or test
  output.

The application must accept the new secret only. If a two-secret rotation is
still in progress, complete the second deployment that removes the previous
secret before any DNS or NS cutover.

Cache policy is fail-safe:

- bypass HTML, RSC, `/api/*`, `/healthz`, Auth, requests with Cookie or
  Authorization, non-GET/HEAD, Server Actions, WebSocket, 4xx, and 5xx;
- allow immutable caching only for `/_next/static/*`;
- do not enable Always Online or an offline cache;
- do not enable Cloudflare Workers on the custom hostname.

## No-DNS-change canary

Pre-validation must not move existing traffic. Cloudflare documents that a
custom hostname already on Cloudflare does not shift to the SaaS zone until its
DNS target changes. An exact custom hostname also has deterministic priority
once DNS points to the SaaS target.

Before touching DNSPod NS or production records:

1. Capture the SaaS target's current Cloudflare edge IPs using a dedicated
   provider-zone hostname.
2. Send `curl --resolve letletme.top:443:<edge-ip>` requests while retaining
   SNI and Host `letletme.top`.
3. Verify `/healthz`, homepage, RSC, static chunk, image, safe API POST, and a
   1-5 MB upload.
4. For runtime responses (`/healthz`, homepage, RSC, image, API, and upload),
   require `X-Letletme-Origin: vercel`,
   `X-Letletme-Edge: cloudflare-fallback`, and the exact current release SHA.
   For `/_next/static/*`, require `X-Letletme-Origin: vercel`, no
   `X-Letletme-Release`, immutable cache headers, and a content hash matching
   the direct Vercel asset.
5. Verify spoofed internal headers cannot choose a client IP, and two source
   IPs do not share the same rate-limit identity.
6. Verify dynamic responses never HIT and the second static request does HIT.
7. Compare at least 20 light samples per representative path from Perth,
   Singapore, and one Europe/US location against the current Cloudflare/Vercel
   production path. Overseas p95 and browser LCP may not regress by more than
   10%; any direct error, 1xxx, 5xx, TLS failure, or unsafe cache fails the
   route.

References: [hostname validation](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/hostname-validation/),
[zero-downtime migration](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/hostname-validation/zero-downtime-migration/),
[hostname priority](https://developers.cloudflare.com/ssl/reference/certificate-and-hostname-priority/).

## DNSPod shadow zone and rollback

Only after the SaaS canary passes:

```text
@ / 境内 / CNAME / <EdgeOne target>
@ / 境外 / CNAME / saas-gateway.qitonglan.com
@ / 默认 / CNAME / saas-gateway.qitonglan.com
```

Run the offline DNSPod validator with `--fallback-type CNAME`. Configure the
watchdog with `DNSPOD_DEFAULT_FALLBACK_TYPE=CNAME`, the exact fallback target
in `DNSPOD_DEFAULT_FALLBACK_VALUE`, and a dedicated `FALLBACK_HEALTH_URL` that
must return the Cloudflare fallback marker and the same release as direct
Vercel. Provision those three bindings together. The watchdog remains disabled
until its healthy, one-failure, three-failure, fallback-unhealthy,
concurrent-manual-edit, and idempotency drills all pass.

If EdgeOne/Tencent fails while the SaaS and direct Vercel probes are healthy,
the watchdog disables only the mainland record. DNSPod then sends mainland
resolvers to the default SaaS route. It never edits the SaaS target and never
automatically restores the mainland route.

The production NS change remains a separate explicit authorization. Until that
authorization, Cloudflare remains authoritative for `letletme.top`, the apex
remains on the current Cloudflare/Vercel path, and all SaaS work is canary-only.
