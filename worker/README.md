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

```bash
npm install -g wrangler
wrangler login

wrangler d1 create vim-wilds-feedback          # copy the id into wrangler.toml
wrangler r2 bucket create vim-wilds-feedback
wrangler d1 execute vim-wilds-feedback --remote --file=./schema.sql

wrangler secret put ADMIN_TOKEN                # any long random string
wrangler deploy
```

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

```bash
export FEEDBACK_ENDPOINT=https://vim-wilds-feedback.example.workers.dev
export FEEDBACK_ADMIN_TOKEN=…
npm run feedback:pull
```

See `scripts/pull_feedback.py`. Reports land in `feedback/`, which is
gitignored.
