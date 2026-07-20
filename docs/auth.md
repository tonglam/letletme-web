# Auth — letletme-web

## Stack

[Better Auth](https://better-auth.com) v1.6.23 · Drizzle ORM · Supabase Postgres (`bauth` schema) · Resend (email delivery)

**Providers:** Email + Password · Google OAuth

---

## Environment variables

```bash
# Database
DATABASE_URL=postgresql://...@pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_DATABASE_URL=postgresql://...@pooler.supabase.com:5432/postgres   # for migrations

# Better Auth
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000          # set to production URL in prod
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# WeChat Mini Program login
WECHAT_MINIPROGRAM_APP_ID=
WECHAT_MINIPROGRAM_APP_SECRET=

# Backend proxy signing key
BACKEND_PROXY_SECRET=<openssl rand -base64 32>

# Internal Data mutation credential (server only)
TOURNAMENT_API_KEY=<openssl rand -base64 32>

# Email (Resend)
RESEND_API_KEY=
MAIL_FROM=no-reply@letletme.top
```

---

## Database setup

Tables live in the `bauth` schema (Supabase reserves `auth` for its own use).

Web is the sole owner of `bauth`. Apply migrations only through the direct,
single-connection runner (never the transaction-mode pooler):

```bash
npm run db:migrate
npm run db:migrate:status
```

The runner requires `DIRECT_DATABASE_URL`, PostgreSQL 15+, creates `bauth`, and
holds a session advisory lock. Web owns the dedicated
`bauth.__drizzle_migrations` ledger; it safely adopts matching historical Web
rows from the shared default Drizzle ledger, then refuses edited, missing,
orphaned, duplicate, or backdated migration history. Fresh and repeat
application are CI gates. A duplicate non-null `openid` aborts migration and
must be reconciled by an operator; accounts are never merged automatically.

Migration `0004_lock_down_bauth` enables RLS, drops historical broad policies,
and revokes `bauth` schema/table/sequence/function access from `PUBLIC`, `anon`,
and `authenticated`. Web, GraphQL Mini Program validation, and migration roles
must use reviewed direct/service database credentials; browser JWTs never query
`bauth`.

Only authenticated server reads attach a signed ingress and user envelope.
Public RSC reads carry no request-derived headers, so Next's shared fetch cache
remains effective and GraphQL treats them as public product queries.

**Tables:** `bauth.user` · `bauth.session` · `bauth.account` · `bauth.verification` · `bauth.rate_limit` · `bauth.request_rate_limits` · `bauth.mini_program_email_code` · `bauth.mini_program_session` · `bauth.fpl_entry_binding_challenges`

**Custom columns on `bauth.user`:**

| Column                  | Type                  | Description                                              |
| ----------------------- | --------------------- | -------------------------------------------------------- |
| `fpl_entry_id`          | integer, nullable     | Bound FPL manager/entry number                           |
| `fpl_entry_bound_at`    | timestamptz, nullable | When the entry was last bound                            |
| `fpl_entry_verified_at` | timestamptz, nullable | When the team-name ownership challenge was completed     |
| `openid`                | text, nullable        | WeChat Mini Program `openid` linked to this website user |

---

## Google OAuth setup

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create **OAuth 2.0 Client ID** (Web application)
3. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://yourdomain.com/api/auth/callback/google` (prod)
4. Copy Client ID → `GOOGLE_CLIENT_ID`, Client Secret → `GOOGLE_CLIENT_SECRET`

---

## Email setup (Resend)

Emails are sent at two points:

- **Email signup** — verification link (must click before first login; `requireEmailVerification: true`)
- **Forgot password** — reset link (expires 1 hour)

Setup:

1. [resend.com](https://resend.com) → Domains → Add Domain → add the DNS records (SPF, DKIM, DMARC) for `letletme.top`
2. API Keys → Create API Key (Sending access) → copy to `RESEND_API_KEY`

Without a verified domain, Resend will reject outbound emails in production.

---

## Auth flows

### Email + Password

```
Sign up → verification email sent → user clicks link → auto sign-in → /onboarding/bind-entry
Forgot password → reset email sent → user clicks link → new password form → signed in
```

### Google OAuth

```
Click "Continue with Google" → Google consent screen → callback /api/auth/callback/google
→ account linked if email matches existing user (trustedProviders) → /onboarding/bind-entry
```

### FPL entry binding

After any first login where `fplEntryVerifiedAt` is null, middleware redirects to `/onboarding/bind-entry`.

1. User enters their FPL entry ID (found at `fantasy.premierleague.com/team/[id]/`)
2. The server validates the public entry and creates a 15-minute `LLM-XXXXXX` team-name challenge.
3. The user changes the FPL team name exactly to that challenge value and confirms it.
4. A transaction locks the challenge and user, sets `fplEntryId`, `fplEntryBoundAt`, and `fplEntryVerifiedAt`, and consumes the challenge.

Existing bindings remain unverified until this flow succeeds. Rebinding always requires a new challenge; profile/onboarding actions never write the binding directly.

Entry can be re-bound anytime from `/profile`.

### Mini Program account linking

The Mini Program must not send or store a raw WeChat user identifier from the client. It calls `wx.login()` and sends the short-lived code to this web backend.

1. Mini Program tries `POST /api/miniprogram/wechat/login` with `{ code, deviceId }`.
2. The backend exchanges the code with WeChat `jscode2session`.
3. If `openid` is already linked in `bauth.user`, the backend returns a Mini Program session token and profile.
4. If not linked, the Mini Program falls back to email-code linking through `/api/miniprogram/email/start` and `/api/miniprogram/email/confirm`.
5. Email confirmation requires a fresh `wechatCode`; the backend exchanges it
   before starting a short transaction that locks user then code, claims the
   unique `openid`, rotates the device session, and consumes the code.

Email challenges are stored as HMAC-SHA-256 values keyed by
`BETTER_AUTH_SECRET`, so the six-digit value is not recoverable from a database
snapshot by hashing the small code space. The WeChat exchange has a 10-second
deadline and returns only generic authentication errors to clients.

Mini Program sessions inherit an entry only when `fpl_entry_verified_at` is
non-null. They last 30 days, with exactly one active token per user/device;
login rotates that token and DELETE `/api/miniprogram/session` revokes it. The
Mini Program never supplies an entry ID to login.

---

## Session

- **Lifetime:** 7 days, renewed if session is >24 h old and `getSession` is called
- **Cookie cache:** 5-minute TTL (`letletme.session_data`) to avoid DB round-trips on every request
- **Cookies:** `httpOnly`, `SameSite=Lax`, `Secure` in production, prefix `letletme`
- **Sign out everywhere:** `/profile/sessions` → "Sign out everywhere" calls `authClient.revokeSessions()`; password reset also revokes all other sessions

Cookie-cached sessions are display-only. GraphQL envelopes, RSC backend
headers, tournament mutations, binding actions, and other authorization
decisions use `getAuthorizationSession()` with `disableCookieCache=true`, so a
rebind or revocation takes effect immediately.

---

## Backend user context envelope

`app/api/graphql/route.ts` injects two headers when a session is present:

```
X-User-Context:     base64url(JSON { v: 2, aud, uid, eid, evat, iat, exp })
X-User-Context-Sig: HMAC-SHA256(payload, BACKEND_PROXY_SECRET) as base64url
```

The backend should:

1. Decode `X-User-Context` from base64url → parse JSON
2. Verify HMAC against `BACKEND_PROXY_SECRET`
3. Reject if `exp` is in the past (60-second window)
4. Accept `eid` only when `evat` is present and the 60-second audience-bound envelope is valid.

Browser-proxied requests and personalized RSC requests also send:

```
X-Ingress-Context:     base64url(JSON { v: 1, aud, sub, iat, exp })
X-Ingress-Context-Sig: HMAC-SHA256(payload, BACKEND_PROXY_SECRET)
```

`sub` is a keyed opaque client-IP subject; raw IPs are neither forwarded nor
stored. Cacheable public RSC requests omit request-derived headers so static
rendering and Next's shared fetch cache remain effective; GraphQL treats those
as ordinary public reads. Production trusts `CF-Connecting-IP` only on the
expected Cloudflare host with Cloudflare metadata, and preview traffic trusts
`x-vercel-forwarded-for` only on a Vercel preview host with Vercel metadata.
Caller-supplied `X-Forwarded-For` is discarded before Better Auth handles a
request.

---

## Route protection

| Route                     | Requires                        |
| ------------------------- | ------------------------------- |
| `/profile`                | session                         |
| `/onboarding/bind-entry`  | session                         |
| `/tournament/create`      | session                         |
| `/tournament/[id]/manage` | session                         |
| `/api/tournaments/*`      | session; mutations/previews also require verified `fplEntryId` in their handlers |
| `/live/points`            | session + verified `fplEntryId` |
| `/live/tournament`        | session + verified `fplEntryId` |
| `/data/selections`        | session + verified `fplEntryId` |
| `/stats/team`             | session + verified `fplEntryId` |
| `/stats/tournament`       | session + verified `fplEntryId` |
| `/tournament/list`        | session + verified `fplEntryId` |
| everything else           | public                          |

`/live/points/[id]` (with an ID segment) is **public** — anyone can view another team. Only the root `/live/points` (your own team) is gated.

Enforcement is two-layered: Next.js `proxy.ts` (optimistic first line) plus
`auth.api.getSession({ disableCookieCache: true })` in every sensitive route
handler/RSC. Proxy checks never replace data-access authorization.

---

## Security notes

- Passwords hashed with **scrypt** (Better Auth default)
- GraphQL request bodies are capped at 256 KiB and every proxied POST is
  `Cache-Control: no-store`; upstream status and `Retry-After` are preserved.
- Auth request bodies are capped at 16 KiB. Database-backed limits are
  120/minute/IP for GraphQL, 5/minute/IP and device for login/confirmation,
  and 5/minute/IP plus 3/hour/email for email start. Auth fails closed if the
  limiter is unavailable; valid read-only GraphQL may fail open with a metric.
- CSRF: Better Auth's origin + Fetch-Metadata checks are enabled — do not disable
- `BETTER_AUTH_SECRET` signs session cookies — rotate immediately if compromised (invalidates all sessions)
- `BACKEND_PROXY_SECRET` signs the user context envelope — rotate with a coordinated backend deploy
- `TOURNAMENT_API_KEY` authenticates Web to Data. Data stores only its SHA-256
  digest; rotate with an overlap window and never expose the plaintext to a client.
- Tournament `adminId` and creator identity are overwritten from the verified
  server session. Browser-supplied identity fields are ignored.
- Never log `X-User-Context-Sig`, password reset tokens, or OAuth `state` params
- The `next` redirect param on `/auth/login` is validated to be a relative path (prevents open redirect)
