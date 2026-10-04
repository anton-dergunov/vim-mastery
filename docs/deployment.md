# Deploying The Vim Wilds

The Vim Wilds is a static Progressive Web App (PWA), published from this
repository at <https://vim-wilds.pages.dev/> on Cloudflare Pages. The root URL
is the introduction and installation page. The playable app and PWA launch URL
are <https://vim-wilds.pages.dev/play/>.

While Cloudflare is on trial the same commit is also published to GitHub Pages
at <https://anton-dergunov.github.io/vim-mastery/>. The two addresses are
separate installs: a browser keeps progress per origin, so progress made on one
does not appear on the other.

## Local development

Install dependencies once, then run the Vite server:

```bash
npm install
npm run dev
```

Open the root URL Vite prints to see the introduction page, or append `/play/`
to start a lesson. Development builds use a version in the form
`0.1.0-dev.<short-git-hash>`. This keeps the local build visibly distinct from
a deployed release.

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main` and can also be
started manually from the Actions tab. It installs dependencies, runs the Vim
and browser test suite once, and then publishes that commit to each host that
is switched on by a repository variable:

| Variable | Host | Also needs |
| --- | --- | --- |
| `DEPLOY_CLOUDFLARE_PAGES=true` | Cloudflare Pages project `vim-wilds` | secret `CLOUDFLARE_API_TOKEN` (permission: Account → Cloudflare Pages → Edit) and variable `CLOUDFLARE_ACCOUNT_ID` |
| `DEPLOY_GITHUB_PAGES=true` | GitHub Pages | **Settings → Pages → Source** set to **GitHub Actions** |

Turning a host off is `gh variable set DEPLOY_GITHUB_PAGES --body false`; the
workflow keeps the code for both.

The site runs under any path. A build is rooted at `/` unless `VITE_BASE` names
a subdirectory, which the workflow sets to `/<repository>/` for the GitHub
Pages build. Nothing in the app names a host.

To publish to Cloudflare from a laptop that has run `wrangler login`:

```bash
VITE_FEEDBACK_ENDPOINT=<worker URL> npm run build
wrangler pages deploy dist --project-name vim-wilds --branch main
```

Wrangler uploads only files whose content changed, so a deployment after the
first takes seconds. Cloudflare Pages redirects `index.html` to its directory
and serves `404.html` for unknown paths; the service worker precaches pages
under their directory URLs for that reason, and leaves `404.html` out.

Each deployed build receives a version such as `0.1.0+02aa1f4c`: the package
version plus the eight-character commit hash. The value is displayed on the
landing page and in the in-game Settings dialog, and is also part of the
service-worker cache name.

## Offline and media policy

The service worker precaches the complete offline application in one install:

- Both HTML pages, JavaScript, CSS, PWA manifest, and icons.
- Every selected scene base, the intro, unit-ending, and
  finale story art, all idle character PNGs, and the character manifest.
- All content: the unit catalog and every unit file, `presentation.json`,
  `reference.json`, `practice-samples.json`, `field-notes.json`,
  `mastery-index.json`, and the language profiles.

Consequently, after the first successful online installation, every available
lesson can be opened and completed in airplane mode. Lesson JSON is fetched at
runtime from the precache rather than compiled into the JavaScript bundle.

Character reaction and action animations and complete-board scene variants
are published with the site but deliberately excluded from service-worker
caches. The app fetches them in memory from its own origin only when needed.
If a request is slow, fails, or the phone is offline, the local base
scene and idle character remain visible without delaying progress.

The runtime manifest is the deployment allowlist for visual media. Builds fail
on a declared missing asset, never discover source masters or review files, and
report the core-media total; they fail above 300 MiB of core media. The PWA
build audit also fails if the whole published artifact reaches GitHub Pages'
1 GiB limit, or Cloudflare Pages' 20,000 files or 25 MiB per file; the measured
margin is in
`docs/design-decisions.md`. A content digest in the cache name
changes whenever any precached asset changes at a stable path. See
`docs/media-and-story-infrastructure.md` for normalization commands and how
story art is wired.

## Feedback reporting

The flag button on the board and the **Report a problem** row in Settings open a
sheet that captures the unit, lesson, activity, editor state, device, viewport
and an optional screenshot, alongside a typed note.

Reports post to a Cloudflare Worker, deployed separately from the site; see
`worker/README.md` for its setup and `scripts/feedback/pull.py` for reading them
back. Set the repository variable `FEEDBACK_ENDPOINT` to connect the two — the
deploy workflow passes it to the build as `VITE_FEEDBACK_ENDPOINT`.

**Leaving it unset is a supported configuration.** The sheet then offers Save and
Copy instead of Send, which is what local development uses and what the app falls
back to whenever the endpoint cannot be reached. A report composed offline is
queued and sends itself later.

## Updates and saved state

The app checks for a new service worker on launch and whenever it returns to
the foreground. A new release downloads all of its offline files in the
background. Once it is ready, the game shows an **Update** action and a
**Restart with update** button in Settings. Restarting activates the waiting
worker and reloads into the new version; it never interrupts a lesson without
the learner choosing to restart.

Learner state lives in `localStorage`, in separate keys so that no surface can
overwrite another's:

- `vim-wilds.session.v1` — the active unit and activity, theme, keyboard,
  effects, backdrop and character preferences, the entry level, and the save
  time.
- `vim-wilds.mastery.v1` — which activities have been completed, how often and
  when, and the pinned concepts. This drives the progress states, focused
  drills, and mixed review.
- `vim-wilds.story.v1` — whether the introduction was seen and which unit
  transitions have played; `vim-wilds.story-transition.v1` holds a transition
  in flight across a refresh.
- `vim-wilds.reference.v1` — whether the orientation deck has been seen.
- `vim-wilds.practice.v1` — whether the free-practice notice has been seen.

Direct `unit` and `activity` query parameters always win over the saved
location. No editor buffer, lesson JSON, or media is stored as learner state,
and no learner data leaves the device except in a problem report the learner
chooses to send.

## The first screen and installing

The root URL shows one card with one leading action, chosen from what the
visitor's browser can do. On a phone that action is installing, because the
installed app has the whole screen and works offline; on a computer it is
practising in the browser.

| Visitor | Leads with | Below it |
| --- | --- | --- |
| Android, once Chrome offers installation | **Install app**, which opens Chrome's install confirmation directly | Try it in the browser |
| Android before that offer, or in a browser that never makes one | **Start practice** | To install, open ⋮ and choose Install app |
| iPhone and iPad, including iPads requesting desktop sites | The three Safari steps: Share, Add to Home Screen, Add | Try it in the browser |
| Computer | **Start practice** | The address to open on a phone, and Install as an app when the browser offers it |

"Start" reads "Continue" when the browser holds saved progress. Instructions
for the other platforms sit under **Installing on another device**. Unlike the
app, this page scrolls, so nothing is out of reach on a short screen.

Chrome's own ⋮ menu offers both **Install** and **Create shortcut**. That sheet
is Chrome's and cannot be changed; the page's Install button skips it. A
shortcut opens in a browser tab, so Install is the one to choose.

The manifest must stay at the site root: its icons, `start_url` and `scope` are
relative to it. Its `<link>` carries `vite-ignore` so the build does not move
it into `assets/`, where those paths would point nowhere and the browser would
refuse to install. The PWA build test checks this.

The service worker answers the first screen from the network whenever there is
one, and from its cache only offline. Everything else is cache-first. Without
this exception a visitor who had opened the app before would keep the old
first screen, and its install instructions, until they applied an update from
inside the app.

The installed app starts at `play/` in a standalone window.

The first installation needs a connection so the complete offline cache can be
downloaded. Updates likewise need a connection once, after which the new lesson
catalog is available offline.

## Other browsers

Use the browser menu’s **Install app** or **Add to Home Screen** command when
available. The app has the same manifest, start route, offline cache, update
behaviour, version display, and remote-animation fallback on all supported
platforms. The landing page’s installation tabs keep the platform-specific
steps to one compact panel.
