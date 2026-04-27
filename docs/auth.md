# Auth — letletme-web

## Stack

[Better Auth](https://better-auth.com) v1.6 · Drizzle ORM · Supabase Postgres (`bauth` schema) · Resend (email delivery)

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

# Backend proxy signing key
BACKEND_PROXY_SECRET=<openssl rand -base64 32>

# Email (Resend)
RESEND_API_KEY=
MAIL_FROM=no-reply@letletme.top
```

---

## Database setup

Tables live in the `bauth` schema (Supabase reserves `auth` for its own use).

```bash
# 1. Create the schema
psql $DIRECT_DATABASE_URL -f drizzle/0000_init_schema.sql

# 2. Generate a migration from lib/db/schema/auth.ts
npm run db:generate

# 3. Apply via psql — drizzle-kit migrate hangs with pgbouncer
psql $DIRECT_DATABASE_URL -f drizzle/<generated>.sql
```

> `drizzle-kit migrate` hangs against the pgbouncer URL (port 6543, transaction mode can't run DDL).
> Always apply migrations via `psql` against port 5432.

**Tables:** `bauth.user` · `bauth.session` · `bauth.account` · `bauth.verification`

**Custom columns on `bauth.user`:**

| Column | Type | Description |
|---|---|---|
| `fpl_entry_id` | integer, nullable | Bound FPL manager/entry number |
| `fpl_entry_bound_at` | timestamptz, nullable | When the entry was last bound |

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
After any first login where `fplEntryId` is null, middleware redirects to `/onboarding/bind-entry`.

1. User enters their FPL entry ID (found at `fantasy.premierleague.com/team/[id]/`)
2. Server action validates against `https://fantasy.premierleague.com/api/entry/{id}/`
3. Writes `fplEntryId` + `fplEntryBoundAt` via `auth.api.updateUser`
4. Redirect to `/`

Entry can be re-bound anytime from `/profile`.

---

## Session

- **Lifetime:** 7 days, renewed if session is >24 h old and `getSession` is called
- **Cookie cache:** 5-minute TTL (`letletme.session_data`) to avoid DB round-trips on every request
- **Cookies:** `httpOnly`, `SameSite=Lax`, `Secure` in production, prefix `letletme`
- **Sign out everywhere:** `/profile/sessions` → "Sign out everywhere" calls `authClient.revokeSessions()`; password reset also revokes all other sessions

---

## Backend user context envelope

`app/api/graphql/route.ts` injects two headers when a session is present:

```
X-User-Context:     base64url(JSON { uid, eid, iat, exp })
X-User-Context-Sig: HMAC-SHA256(payload, BACKEND_PROXY_SECRET) as base64url
```

The backend should:
1. Decode `X-User-Context` from base64url → parse JSON
2. Verify HMAC against `BACKEND_PROXY_SECRET`
3. Reject if `exp` is in the past (60-second window)
4. Trust `eid` as the authoritative FPL entry ID for this request

Until the backend implements this, the headers are forward-compatible no-ops.

---

## Route protection

| Route | Requires |
|---|---|
| `/profile` | session |
| `/onboarding/bind-entry` | session |
| `/tournament/create` | session |
| `/tournament/[id]/manage` | session |
| `POST /api/tournaments` | session |
| `/live/points` | session + `fplEntryId` |
| `/live/tournament` | session + `fplEntryId` |
| `/data/selections` | session + `fplEntryId` |
| `/stats/team` | session + `fplEntryId` |
| `/stats/tournament` | session + `fplEntryId` |
| `/tournament/list` | session + `fplEntryId` |
| everything else | public |

`/live/points/[id]` (with an ID segment) is **public** — anyone can view another team. Only the root `/live/points` (your own team) is gated.

Enforcement is two-layered: `middleware.ts` (first line) + `auth.api.getSession()` in each route handler / RSC (defense in depth).

---

## Security notes

- Passwords hashed with **scrypt** (Better Auth default)
- Rate limiting: 100 req / 60 s per IP on all auth endpoints (Better Auth built-in)
- CSRF: Better Auth's origin + Fetch-Metadata checks are enabled — do not disable
- `BETTER_AUTH_SECRET` signs session cookies — rotate immediately if compromised (invalidates all sessions)
- `BACKEND_PROXY_SECRET` signs the user context envelope — rotate with a coordinated backend deploy
- Never log `X-User-Context-Sig`, password reset tokens, or OAuth `state` params
- The `next` redirect param on `/auth/login` is validated to be a relative path (prevents open redirect)
