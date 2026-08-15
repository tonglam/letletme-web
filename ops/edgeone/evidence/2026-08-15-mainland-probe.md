# Mainland probe — 2026-08-15

This is a read-only probe from the Tencent Lighthouse host in mainland China.
It was reached over the already-established WireGuard path through the active
overseas host; no production configuration or traffic was changed.

Probe time: `2026-08-15T21:27Z` UTC.

## Results

- Direct Vercel `https://letletme-web.vercel.app/healthz`: 3/3 attempts failed
  during TCP connection establishment with a three-second connect timeout.
- EdgeOne canary `https://eo-canary.letletme.top/healthz`: 3/3 attempts
  returned HTTP `000` after eight seconds with zero response bytes. The DNS
  answers varied across EdgeOne addresses, but none produced an HTTP response.
- Current production apex `https://letletme.top/healthz`: returned HTTP `200`
  through Cloudflare, with TTFB about `2.318s` in the same probe.

The direct Vercel baseline is unreachable from this mainland source, so a
20-sample p50/p95 comparison cannot be computed. The EdgeOne canary is also
not a viable mainland entry point: it failed all three bounded attempts while
the current Cloudflare fallback returned successfully. This is a functional
cutover failure, not evidence that EdgeOne improved mainland performance.

## Decision

Keep the apex on the current no-cost production path:

```text
Cloudflare Proxied apex → Transform Rules → Vercel Production
```

Do not point the apex at EdgeOne, enable the watchdog, expose the Tencent
Lighthouse host as a Web origin, or enable paid Smart Acceleration. A future
re-evaluation must first explain the mainland EdgeOne timeout and establish a
reachable direct-origin baseline from the same class of source.
