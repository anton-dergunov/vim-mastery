# Deploying The Vim Wilds

The Vim Wilds is a static Progressive Web App (PWA), published from this
repository at <https://anton-dergunov.github.io/vim-mastery/>. The root URL is
the introduction and installation page. The playable app and PWA launch URL
are <https://anton-dergunov.github.io/vim-mastery/play/>.

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

## GitHub Pages deployment

`.github/workflows/deploy-pages.yml` runs on every push to `main` and can also
be started manually from the Actions tab. It installs dependencies, runs the
Vim and browser test suite, creates a production build, and deploys `dist`
using the official GitHub Pages Actions flow.

Before the first deployment, set **Settings → Pages → Build and deployment →
Source** to **GitHub Actions** in the `anton-dergunov/vim-mastery` repository.
The workflow then deploys only from `main`.

Each deployed build receives a version such as `0.1.0+02aa1f4c`: the package
version plus the eight-character commit hash. The value is displayed on the
landing page and in the in-game Settings dialog, and is also part of the
service-worker cache name. The workflow supplies the exact commit hash for
remote celebration media, so the app shell and its media references always
refer to the same revision.

## Offline and media policy

The service worker precaches the complete offline application in one install:

- Both HTML pages, JavaScript, CSS, PWA manifest, and icons.
- Every selected registered-scene base and exact-registration patch.
- Approved story and reaction stills, all idle character PNGs, and the
  character manifest.
- The language profile data, unit catalog, and every unit JSON file.

Consequently, after the first successful online installation, every available
lesson can be opened and completed in airplane mode. Lesson JSON is fetched at
runtime from the precache rather than compiled into the JavaScript bundle.

Success-animation WebP files and complete-board scene variants are emitted to
the GitHub Pages artifact but deliberately excluded from service-worker caches.
The app fetches them in memory from that one Pages media origin only when
needed. Local Vite development tries the project path first and then the same
Pages URL. If a request is slow, fails, or the phone is offline, the local base
scene and idle character remain visible without delaying progress.

The runtime manifest is the deployment allowlist for visual media. Builds fail
on a declared missing asset, never discover source masters or review files, and
report the deterministic core-media total without enforcing a size gate. A
content digest in the cache name changes whenever any precached asset changes
at a stable path. See `docs/media-and-story-infrastructure.md` for normalization
commands and the WP-11 integration contract.

## Updates and saved state

The app checks for a new service worker on launch and whenever it returns to
the foreground. A new release downloads all of its offline files in the
background. Once it is ready, the game shows an **Update** action and a
**Restart with update** button in Settings. Restarting activates the waiting
worker and reloads into the new version; it never interrupts a lesson without
the learner choosing to restart.

The compact session record persists the active unit, active activity, theme
preference, keyboard preference, and save timestamp. Independent story state
stores only whether the introduction was seen and which unit transitions have
already played by default. Direct `unit` and `activity` query parameters always
win over the saved location. No editor buffers, educational completion ledger,
lesson JSON, or animation media is stored as user state.

## Installing on iPhone and iPad

1. Open <https://anton-dergunov.github.io/vim-mastery/> in **Safari**.
2. Tap **Share**, then choose **Add to Home Screen**.
3. Tap **Add**. Vim Wilds now starts from the Home Screen in its own app window.

Safari is the recommended browser for iPhone and iPad installation. The landing
page selects these instructions automatically, including on iPads that request
desktop-style sites; its tabs also let visitors read the instructions for a
different device.

## Installing on Android

1. Open <https://anton-dergunov.github.io/vim-mastery/> in Chrome on Android.
2. Tap **Install Vim Wilds** when Chrome offers it, or use Chrome’s three-dot
   menu and choose **Install app**.
3. Open Vim Wilds from the new home-screen icon. It starts at `/play/` in a
   standalone app window.

The first installation needs a connection so the complete offline cache can be
downloaded. Updates likewise need a connection once, after which the new lesson
catalog is available offline.

## Other browsers

Use the browser menu’s **Install app** or **Add to Home Screen** command when
available. The app has the same manifest, start route, offline cache, update
behaviour, version display, and remote-animation fallback on all supported
platforms. The landing page’s installation tabs keep the platform-specific
steps to one compact panel.
