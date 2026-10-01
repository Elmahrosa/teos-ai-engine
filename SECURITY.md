# Security Policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately rather than opening a public
issue. Do not include real credentials, tokens, or customer data in a report or
a pull request.

## Required production configuration

Two settings are load-bearing. The application degrades rather than crashes when
they are missing, which makes the misconfiguration easy to miss.

### `AUTH_SECRET` (or `NEXTAUTH_SECRET`)

Required. Without it the app falls back to a cryptographically random secret
generated **per process**, which means:

- every restart invalidates all sessions, and
- sessions do not work across multiple instances.

Generate one with `openssl rand -base64 32`. The app logs a warning at startup
when it is unset.

### `ADMIN_EMAILS`

Required. Comma-separated. This is the **only** way to grant admin access —
there are no hardcoded allowlists left in the code.

`isAdminEmail()` in `lib/access.ts` fails **closed**: if the variable is unset
or empty, everyone is denied. Anyone listed here is treated as an admin and
bypasses the media-synthesis paid-tier gate, so every operator who needs that
access must be present.

Affects `/api/admin`, `/api/audit`, `/api/admin/*`, and media generation.

---

## Incident runbook: 2026-09 audit disclosure and OAuth account takeover

Two vulnerabilities were fixed in `b59104f` (2026-10-01). Both were reachable
by unauthenticated callers. **Fixing them stops new exploitation but does not
undo anything that already happened**, so the following triage should be run
against production and any retained backups.

### 1. Was the audit endpoint read?

`GET /api/audit` previously required no authentication and returned the last
100 audit records, including each user's `id`, `email`, `name` and logged `ip`.

Look for unauthenticated requests to `/api/audit` that received `200`:

- GitHub Pages does **not** expose request logs, so check whichever access log
  or log sink is actually in use — `LOG_WEBHOOK_URL` is wired up in
  `.env.example`, and any reverse proxy/WAF/CDN in front of the deployment will
  have the authoritative record.
- Scope: from the earliest deployment of this code up to the deploy that
  shipped `b59104f`.
- If hits are found, treat it as a **confirmed disclosure of user PII plus IP
  addresses**. Notify affected users per applicable privacy law, and rotate any
  credential that was reused elsewhere.

### 2. Were accounts claimed?

`authorizeCredentials` previously adopted any caller-supplied password for
accounts whose `passwordHash` was null — which is exactly the state left by an
OAuth signup (Google, Twitter, LinkedIn, Azure). Anyone who knew a victim's
email could set a password and take over the account permanently.

An attacker who did this before the fix wrote their own `passwordHash`, so
those accounts still authenticate normally and the fix does not evict them.

Run this against production:

```sql
SELECT u.email,
       u."createdAt"                        AS oauth_account_created,
       u."passwordHash" IS NOT NULL         AS has_password_set,
       u."lastActiveAt"                     AS last_active,
       a.provider                           AS oauth_provider
FROM "User" u
JOIN "Account" a ON a."userId" = u.id
WHERE u."passwordHash" IS NOT NULL
ORDER BY u."lastActiveAt" DESC;
```

Interpretation:

- **Healthy baseline:** every row here is a user who signed up with a password
  *and later* linked an OAuth provider. That is legitimate, so this query is a
  **triage list, not proof of compromise**.
- **Strong signal:** a user with an `Account` row whose `oauth_account_created`
  is older than their first credentials login, especially where the account has
  an unusual `lastActiveAt`, a foreign IP, or no history of use.

Cross-reference against the `AuditLog` table for that user — legitimate
credentials logins are recorded as `action = 'login'` with
`metadata.method = 'credentials'`. An account whose first recorded login is
credentials-based, but which was created via OAuth, is worth investigating.

For each confirmed takeover: force a password reset, revoke active sessions
(session strategy is JWT, so rotating `AUTH_SECRET` invalidates all sessions
org-wide — the blunt but complete option), and review the account's activity.

### 3. Confirm the fixes are live

```
GET /api/audit
```

Must return `401 {"error":"Unauthorized"}`. A `200` means the deployment is
still running pre-`b59104f` code.