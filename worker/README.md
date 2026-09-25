# Feedback receiver

The app is a static PWA on GitHub Pages, so there is nowhere in it to put a
secret and nowhere for a report to land. This Worker is that place. It is
deployed separately from the Pages build and is the only server-side component
in the project.

Reports go to D1; screenshots, when there are any, go to R2. Nothing here writes
to GitHub, which is the point: the repository is public and the review backlog
is not. Filing a public issue stays a decision made per report during triage.

## What it stores, and what it does not

One row per report: the rendered Markdown the reporter reviewed before sending,
the structured envelope for querying later, and an R2 key when an image was
attached. **The client IP is deliberately not recorded.** Cloudflare needs it to
route and rate-limit the request; this database has no use for it.

## Routes

| Route | Method | Access |
| --- | --- | --- |
| `/report` | `POST` | Public, restricted by `Origin`, 2 MB cap |
| `/reports?since=&limit=` | `GET` | `Authorization: Bearer $ADMIN_TOKEN` |
| `/screenshot/:id` | `GET` | `Authorization: Bearer $ADMIN_TOKEN` |

`POST /report` takes `multipart/form-data` with `report` (the JSON envelope),
`markdown` (the rendered text) and an optional `screenshot`. A report without an
image is ordinary, not degraded: the field is simply absent.

## On the Origin allowlist

Browsers set the `Origin` header themselves and page scripts cannot forge it, so
checking it stops another website from posting into the database and stops a
stray script in someone's browser from reaching the endpoint.

It is worth being clear about what that does **not** cover. The guarantee holds
only inside a browser — `curl -H "Origin: …"` sets whatever it likes. So this is
a filter against casual and accidental abuse, not a security boundary. What
actually bounds the damage is the rate limit, the 2 MB payload cap, and the fact
that reading anything back requires the admin token. That is a sensible trade
while the app has no users; revisit it before publicising it, at which point
Turnstile becomes worth its cost.

## Setup

Every command below runs **from this `worker/` directory**, not the repository
root — wrangler resolves `wrangler.toml` and `./schema.sql` relative to the
working directory.

```bash
npm install -g wrangler
wrangler login
cd worker

# Paste the printed database_id into wrangler.toml, replacing the placeholder.
# Keep the binding names DB and SCREENSHOTS: the Worker reads env.DB and
# env.SCREENSHOTS, so wrangler's suggested snippet is not what you want here.
wrangler d1 create vim-wilds-feedback

# R2 has to be switched on once in the dashboard before this succeeds.
wrangler r2 bucket create vim-wilds-feedback

wrangler d1 execute vim-wilds-feedback --remote --file=./schema.sql
wrangler secret put ADMIN_TOKEN                # any long random string
wrangler deploy
```

If `d1 execute` reports `Invalid property: databaseId => Invalid uuid`, the
placeholder is still in `wrangler.toml`.

On the first deploy wrangler asks for a `workers.dev` subdomain. **That is an
account-wide namespace, not this Worker's name** — every Worker on the account
becomes `<worker-name>.<subdomain>.workers.dev`. Give it an identity (a handle or
a brand), not a project name, or unrelated Workers end up living under this
project's URL. It is editable later at
`https://dash.cloudflare.com/<account-id>/workers/subdomain`, at the cost of
changing the hostname of every Worker on the account.

The durable alternative, once the app has real users, is a custom domain: add a
route on a zone Cloudflare already serves DNS for and the endpoint stops
depending on `workers.dev` at all. Remember to add the new origin to
`ALLOWED_ORIGINS` and redeploy.

Then add a rate-limiting rule on the deployed route in the Cloudflare dashboard
(Security → WAF → Rate limiting rules); something like 20 requests per minute per
IP is far above real use and far below anything worth worrying about.

## Connecting the app

The endpoint URL is baked into the client bundle at build time and is therefore
public. That is expected — it is a write-only endpoint, and the Origin check,
rate limit and size cap are the protection.

Set a repository variable `FEEDBACK_ENDPOINT` (Settings → Secrets and variables
→ Actions → Variables); the Pages workflow passes it through as
`VITE_FEEDBACK_ENDPOINT`. Locally:

```bash
VITE_FEEDBACK_ENDPOINT=https://vim-wilds-feedback.example.workers.dev npm run dev
```

**With the variable unset the app still works.** Send is hidden and Save and
Copy take over, which is what local development uses and what the app falls back
to whenever the endpoint is unreachable.

## Reading reports

Three routes, deliberately. The first is for triage; the others exist so a
broken Worker, a lost token or a bad deploy can never put reports out of reach.

### 1. Sync to local Markdown — the triage route

```bash
export FEEDBACK_ENDPOINT=https://vim-wilds-feedback.<subdomain>.workers.dev
export FEEDBACK_ADMIN_TOKEN=…
npm run feedback:pull
```

Writes `feedback/<date>-<activity>/report.md` plus the screenshot, so reports
can be read directly by an agent working in the repository. `feedback/` is
gitignored. See `scripts/feedback/pull.py`.

### 2. Query D1 directly — the route that depends on nothing

This talks to D1 through the Cloudflare API using your `wrangler login` session.
No `ADMIN_TOKEN`, no Worker, no HTTP route: it works even if the Worker is
broken or deleted.

```bash
cd worker
wrangler d1 execute vim-wilds-feedback --remote \
  --command "SELECT created_at, unit_id, activity_id, note FROM reports ORDER BY created_at DESC LIMIT 20;"

# The full rendered report, exactly as it was reviewed before sending:
wrangler d1 execute vim-wilds-feedback --remote \
  --command "SELECT markdown FROM reports ORDER BY created_at DESC LIMIT 1;"
```

### Marking a report processed

Triage state lives on the server, not in the local directory, so it survives a
re-clone and can be read from a phone. `status` is one of `new`, `done` or
`wontfix`, with an optional resolution note.

```bash
npm run feedback:mark -- --list                       # what is still open
npm run feedback:mark -- 2026-09-07-yank-ready-field done "fixed in a1b2c3"
npm run feedback:mark -- 94dd7fb1 wontfix "works as intended"
npm run feedback:mark -- 94dd7fb1 new                 # reopen, clearing the note
```

A report is addressed by the directory name the pull created or by any
unambiguous prefix of its id; an ambiguous prefix is refused rather than
resolved arbitrarily. The id prefix works even with no local copy, so a report
can be closed after `feedback/` has been deleted.

The local mirror is updated immediately, and a later pull re-reads triage state
for every report, so marking something from the dashboard shows up on the next
sync. `feedback/index.md` lists open reports first.

From the D1 console or the CLI, the same thing in SQL:

```sql
UPDATE reports SET status = 'done', resolution = 'fixed in a1b2c3',
       resolved_at = datetime('now') WHERE id LIKE '94dd7fb1%';
```

### 3. The Cloudflare dashboard — the phone-friendly route

- **Notes and context**: Workers & Pages → D1 → `vim-wilds-feedback` → Console.
  The same `SELECT` statements, in a browser.
- **Screenshots**: R2 → `vim-wilds-feedback` → the `screenshots/` prefix. Each
  object is `<report-id>.webp`, viewable and downloadable in place.

## If a read fails

A **401** is the Worker rejecting the token: `FEEDBACK_ADMIN_TOKEN` does not
match the `ADMIN_TOKEN` secret. Reset it with `wrangler secret put ADMIN_TOKEN`.

A **403** is *not* an auth failure — this route never answers 403. It is
Cloudflare's browser integrity check rejecting the request at the edge, before
the Worker runs, and it comes with `error code: 1010`. The usual cause is a user
agent that looks like a scripting library: `urllib` defaults to
`Python-urllib/x.y`, which is banned, which is why the sync script sets its own.
Reports are unaffected — read them with route 2 while sorting it out.
