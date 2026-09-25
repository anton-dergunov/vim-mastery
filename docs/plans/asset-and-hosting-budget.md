# Asset and hosting budget

**Size:** M. **Depends on:** nothing.

## Why

Session 23 shipped five new illustrated boards and wrote down a trigger:
"revisit the hosting architecture before it reaches 950 MiB." The build is now
past the point where that sentence was a precaution.

Measured today:

| | |
| --- | --- |
| `dist/` total | **888 MB** — against GitHub Pages' **1 GB** artifact limit |
| `dist/assets/` | 885 MB (everything else in the build is ~4 MB) |
| `assets/` working tree | 1.0 GB |
| `.git` | 1.1 GB |

The shape of the problem is not what the raw number suggests, and getting this
right is most of the session:

| Tier | Files | Bytes | Ceiling |
| --- | --- | --- | --- |
| **Core** (service-worker precache) | 150 | **47.8 MiB** | 300 MiB, enforced |
| **Optional** (fetched lazily at runtime) | 1266 | **831.9 MiB** | none |

So the precache is nowhere near its limit and is not the problem. **The problem
is the optional tier**, which still has to be uploaded to Pages even though the
service worker never precaches it. It breaks down as:

- **900 `remote-scene-variant` files** — 18 scenes × 10 sites × 5 variants.
  This is 90% of the overhang on its own.
- **216 `character-reaction`** frames.
- **150 `character-animation`** frames.

The hard deadline is the Pages 1 GB artifact limit, ~112 MB away, and any new
art has to fit under it.

## Scope

### 1. Measure, and write the measurement down

Reproduce the table above from the repository rather than trusting it — the
numbers move with every art session. `collectMediaPolicy` in `media-policy.js`
gives both tiers (`coreMediaBytes` there is internal; export it if a script
needs it); `remoteVariantPaths` in
`presentation-data.js` gives the variant expansion. Then add the measurement to
the test tier so it stops being a thing someone has to remember to check:
`tests/media-policy.test.mjs` asserts the core ceiling
(`CORE_MEDIA_MAX_BYTES`, 300 MiB), and `tests/pwa-build.test.mjs` already fails
when the published build reaches GitHub Pages' 1 GiB (`GITHUB_PAGES_MAX_BYTES`).
That total check only runs in `npm run test:pwa`, which is CI-only, so the
margin (886 MB built on 2026-09-25) is still easy to miss locally. Report it
somewhere a local run shows it, or give the check a warning threshold well
below the limit.

### 2. Decide where the optional tier lives

The three candidate answers, in the order the evidence favors them:

- **Serve the optional tier from object storage or a CDN**, leaving core media
  in the build. Session 23's own advice ("prefer external object/CDN hosting for
  any substantial video") points here, and it is the only option that scales.
  **Resolve the offline rule explicitly before choosing it.** `AGENTS.md` says
  "Keep the runtime local and offline-capable: plain HTML, CSS, JavaScript
  modules, and local assets only." Remote scene variants are already fetched
  lazily and are already absent from the precache, so the app already works
  offline without them — but the rule as written does not distinguish tiers. If
  this option is chosen, **amend `AGENTS.md`** to say what "local assets only"
  means per tier. Do not quietly reinterpret it.
- **Reduce `variantsPerSite`.** Five variants per site across ten sites is a
  richness choice, not a requirement. Cutting to three would remove ~360 files
  and roughly a third of the overhang with no architectural change. Cheapest
  option; costs visible variety.
- **Git LFS.** Session 23 already priced this and deferred it: ~1.3 GB, 2,907
  objects, 134 commits to rewrite. It shrinks the clone, **not the Pages
  artifact**, so on its own it does not solve the deadline. Only worth doing for
  the `.git` problem, and only alongside one of the above.

Whichever host is chosen, note that **GitHub Pages does not allow commercial
use** — its terms exclude an online business, e-commerce site, or commercial
SaaS ([limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)).
It is fine for the free product today, but a host picked now for the optional
tier or the whole app should also work if the product ever takes payments; see
[../ideas/launch-and-monetization.md](../ideas/launch-and-monetization.md#hosting-and-payments).

Pick one, implement it, and record the reasoning in
[../design-decisions.md](../design-decisions.md). A decision recorded is worth more than the bytes.

### 3. Resolve `open-trail-overlook`

The fifth board session 23 generated has 50 approved variants, 5.4 MB on disk,
and **no unit**. It is correctly isolated today: `integrationState:
"reserve-only"` in `scripts/world-art/board-edit-patch-summary.json`, absent
from `content/presentation.json`, absent from `dist/`, and pinned in that state
by `tests/media-policy.test.mjs:19-24`.

Either assign it to a unit or delete it. Session 23's constraint stands: **it
must not create an empty unit** — a board is not a reason to invent curriculum.
If neither assigning nor deleting is right yet, say so in `../design-decisions.md` with the
date and the condition that would decide it, and leave the test pin alone. What
is not acceptable is leaving it undiscussed for a third session.

## Out of scope

- Regenerating, re-approving, or re-cropping any board. The art is final.
- Veo video loops. Optional and unstarted; if this session concludes that video
  is affordable, record that and stop.
- Lowering `CORE_MEDIA_MAX_BYTES`. At 47.8 MiB of 300 the ceiling is doing its
  job — catching a mistake, not rationing artwork, exactly as its comment says.

## Validation

- `npm run test:media` and `npm test`.
- `npm run build`, then measure `dist/` and confirm the number matches what the
  new assertion expects.
- `npm run test:pwa` — the full PWA build audit. It is normally CI-only; run it
  here, because this session changes what ships.
- Load the app with the network throttled and confirm every surface that depends
  on an optional asset still degrades gracefully. `setLayerAsset` in
  `story-transitions.js` already tolerates a missing asset by removing the
  property; confirm nothing else assumes presence.
- If the optional tier moved: verify offline behavior after a cold install, with
  the external host unreachable. The app must still run every lesson.
