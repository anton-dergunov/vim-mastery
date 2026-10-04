# Finish the move to Cloudflare, then rename the repository to `vim-wilds`

Status: hosting trial live (2026-10-04). The site is at
<https://vim-wilds.pages.dev/> and still on GitHub Pages; how both are deployed
is in `docs/deployment.md`, and the decision and its limits are in
`docs/design-decisions.md`. What remains is below, in order. Steps marked
**Anton** need the Cloudflare or GitHub account.

## Done

- The build names no host or path (`VITE_BASE`, default `/`); optional media
  comes from the site's own origin.
- Cloudflare Pages accepted the whole 880 MB build in one direct upload. This
  was the open question; no R2 media origin is needed.
- Checked on the live address: a lesson completes, optional media loads, the
  service worker installs, and the app opens and completes a lesson offline.
- One workflow tests once and deploys to each host behind a repository variable.

## Remaining

### 1. Turn on the Cloudflare deployment in CI (**Anton**)

Create an API token (dash.cloudflare.com → My Profile → API Tokens → Custom
token, permission Account → Cloudflare Pages → Edit), then:

```bash
gh secret set CLOUDFLARE_API_TOKEN
gh variable set DEPLOY_CLOUDFLARE_PAGES --body true
```

### 2. Deploy the feedback Worker with the new origin

`worker/wrangler.toml` already lists `https://vim-wilds.pages.dev`. Run
`wrangler deploy` in `worker/`, send a report from the new address, and pull it.

### 3. Check on a phone (**Anton**)

Install from <https://vim-wilds.pages.dev/>, switch to airplane mode, open and
finish a lesson. After a later deployment, confirm the update is offered.

### 4. Switch GitHub Pages off, when the trial is judged a success

```bash
gh variable set DEPLOY_GITHUB_PAGES --body false
```

The workflow keeps the GitHub Pages code. Then remove
`https://anton-dergunov.github.io` from `ALLOWED_ORIGINS`, redeploy the Worker,
disable Pages in the repository settings, and drop the second address from
`docs/deployment.md`. Progress is kept per origin, so it does not follow from
the old address to the new one.

### 5. Make the repository private (**Anton**, optional)

Only after step 4: on the free plan GitHub Pages stops for a private
repository. A private repository gets 2,000 free Actions minutes a month; a
deploy run takes about 20, and the branch test workflow shares the allowance.
Mark it `state: private` in `~/projects/_structure/portfolio/projects.yaml`.

### 6. Rename the repository (**Anton**, or an agent with `proj`)

Only after step 4, because the GitHub Pages address changes with the name.

```bash
cd ~ && proj mv vim-mastery vim-wilds --github
```

That renames the folder and the GitHub repository, moves the Claude Code
history, and updates `repos.yaml` and `portfolio/projects.yaml` in
`~/projects/_structure`. Afterwards:

- recreate `node_modules` only if a build fails;
- in `projects.yaml`, set `homepage:` to the new address, then run
  `portfolio github` and `portfolio blog`;
- the label `=vim-mastery=` in `Work/Products.org`.

## Done when

- `https://vim-wilds.pages.dev` serves the current build from CI, installs, and
  works offline.
- No file in the repository mentions `vim-mastery` or `anton-dergunov.github.io`
  except the history of this decision.
- The repository is `anton-dergunov/vim-wilds` and `proj status` is clean.

A custom domain is a later, separate step: add it in the Pages project, add it
to `ALLOWED_ORIGINS`, and nothing else changes.
