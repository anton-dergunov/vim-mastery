# Move hosting to Cloudflare, then rename the repository to `vim-wilds`

Status: not started (written 2026-10-02). A task a coding agent can carry out,
except the steps marked **Anton**, which need the Cloudflare or GitHub account.

## Why

- The published build is 877 MiB against GitHub Pages' 1 GiB limit, and Pages has
  a soft bandwidth limit of 100 GB a month.
- GitHub's terms exclude commercial use of Pages; `design-decisions.md` already
  names "the product takes payments" as the point at which hosting moves.
- The site URL is tied to the repository name, which is why the repository
  cannot be renamed to match the product. `vite.config.js` hard-codes
  `/vim-mastery/`.
- The feedback receiver already runs on Cloudflare (Worker, D1, R2), so the
  account, the tooling and `wrangler` are in place.

Checked on 2026-10-02 against Cloudflare's documentation: requests to static
assets are free and unlimited; the free plan allows 20,000 files per deployment
and 25 MiB per file; a `pages.dev` address is free. The build has 1,410 files and
its largest is 2.9 MB.

**Not confirmed: whether a deployment of 877 MiB in total is accepted.** Nothing
in the limits says it is not. Step 2 finds out before anything else is changed.

## What changes in the code

The site becomes independent of where it is served.

| Where | Now | After |
|---|---|---|
| `vite.config.js:154` | `base` is `/vim-mastery/` for builds | `/` (read from `VITE_BASE`, default `/`) |
| `src/app/version.js` | `remoteMediaUrls` returns the absolute GitHub Pages URL, also in production | same origin in production (`appUrl(path)`); in development, the local path first, then the production origin from a build variable such as `VITE_MEDIA_ORIGIN` |
| `worker/wrangler.toml` | `ALLOWED_ORIGINS` lists `https://anton-dergunov.github.io` | add the new origin; keep the old one until Pages is retired |
| `.github/workflows/deploy-pages.yml` | builds, tests, deploys with the GitHub Pages actions | same build and tests, deploys with `wrangler pages deploy dist` |
| `tests/pwa-build.test.mjs:45` | expects `/vim-mastery/icons/...` | expects `/icons/...` |
| `tests/pwa-build.test.mjs:10,101` | fails at GitHub Pages' 1 GiB | fails above 20,000 files or a file above 25 MiB |
| `tests/moonroot-world.spec.js:604` | expects the fallback media origin `https://anton-dergunov.github.io` | expects the configured media origin |
| `tests/editor-conformance.spec.js:2319` | routes `raw.githubusercontent.com/anton-dergunov/vim-mastery/**`, which nothing in `src/` requests | remove the route, or point it at what the test actually needs |

The manifest already uses relative `start_url` and `scope`, and the service
worker resolves against its own scope, so neither needs a change.

## Steps

### 1. Make the build origin-independent

Make the changes in the table except the workflow and `ALLOWED_ORIGINS`. Keep the
GitHub Pages deployment working during the trial by setting `VITE_BASE=/vim-mastery/`
and the media origin in the existing workflow. `npm run test:full` must pass.

### 2. Trial deployment from the laptop (**Anton**: `wrangler login`)

```bash
VITE_BASE=/ npm run build
npx wrangler pages project create vim-wilds --production-branch main
npx wrangler pages deploy dist --project-name vim-wilds
```

This answers the open question. If the upload is refused for its size, keep the
application and the 39 MiB of precached media on Pages and move the 832 MiB of
optional media (character reactions and animations, scene variants) to the R2
account, served from its own origin through `VITE_MEDIA_ORIGIN`. R2's free tier
is 10 GB with no egress charge. Decide then; do not build it in advance.

### 3. Verify on `https://vim-wilds.pages.dev`

- The landing page and `/play/` load; a lesson can be completed.
- On a phone: install the app, switch to airplane mode, open and finish a lesson.
- Optional media appears: a character animation and a scene variant.
- A service-worker update is picked up after a second deployment.
- The feedback sheet posts a report once step 4 is done.
- Response headers for `service-worker.js` do not cache it for long. If they do,
  add a `_headers` file to the build output. Media lives at stable paths, so do
  not mark it immutable.

### 4. Allow the new origin in the feedback Worker (**Anton**: deploy)

Add `https://vim-wilds.pages.dev` to `ALLOWED_ORIGINS` and run `npx wrangler deploy`
in `worker/`.

### 5. Deploy from CI

Replace the Pages steps in the workflow with a Cloudflare deployment and drop the
`pages` and `id-token` permissions and the `environment` block:

```yaml
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=vim-wilds --branch=main
```

**Anton:** create an API token limited to Cloudflare Pages edit, and add both
secrets to the repository. Check the action's current syntax when doing this.
Rename the workflow file; it is no longer `deploy-pages`.

### 6. Retire GitHub Pages

- Progress is kept in the browser per origin, so progress made on the old address
  does not follow to the new one. There is no cohort yet; tell the few people who
  have it installed, and reinstall from the new address.
- Make the last Pages deployment a single page that links to the new address,
  and leave it up until those people have moved.
- Then disable Pages in the repository settings.

### 7. Documentation

- `README.md`: the live link.
- `docs/deployment.md`: rewrite the hosting section, the media-origin paragraph
  and the two install walkthroughs for the new address.
- `docs/design-decisions.md`: replace the settled decision "Hosting stays on
  GitHub Pages" with this one, including the new limits and what is watched.
- `docs/ideas/launch-and-monetization.md`: the hosting bullet.
- `worker/README.md`: its first paragraph says the app is on GitHub Pages.

### 8. Rename the repository (**Anton**, or an agent with `proj`)

Only after step 6, because the old Pages address stops working the moment the
repository is renamed.

```bash
cd ~ && proj mv vim-mastery vim-wilds --github
```

That renames the folder and the GitHub repository, moves the Claude Code
history, and updates `repos.yaml` and `portfolio/projects.yaml` in
`~/projects/_structure`. Afterwards:

- recreate `node_modules` only if a build fails;
- in `~/projects/_structure/portfolio/projects.yaml`, set `homepage:` to the new
  address, then run `portfolio github` and `portfolio blog`;
- the label `=vim-mastery=` in `Work/Products.org`;
- the repository can then be made private at any time: nothing depends on it
  being public any more. If it is, mark it `state: private` in `projects.yaml`.

## Done when

- `https://vim-wilds.pages.dev` serves the current build from CI, installs, and
  works offline.
- No file in the repository mentions `vim-mastery` or `anton-dergunov.github.io`
  except the history of this decision.
- The repository is `anton-dergunov/vim-wilds` and `proj status` is clean.

A custom domain is a later, separate step: add it in the Pages project, add it to
`ALLOWED_ORIGINS`, and nothing else changes.
