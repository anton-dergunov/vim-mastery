# Story scene review links

Start the local app on the review port:

```sh
npm run dev -- --port 4176
```

The [all-scenes review hub](http://127.0.0.1:4176/play/?preview=story-index)
renders every story panel in the production dialog. Candidate links below use
the real completion surface; review at 360×740 before approving a painting.

## Approved bespoke endings

Units 10, 16, and 17 now use owner-approved semantic story WebPs. The generated
candidates stay under `artifacts/` as review provenance and are not emitted by
the PWA build.

| Unit | Approved | Contact sheet | Candidate review links |
|---|---:|---|---|
| 10 · `viewport-control` | 4 | `artifacts/world-generation/wp11/story-review-v2/unit-endings/viewport-control-restoration-3x4/contact-sheet.jpg` | [1](http://127.0.0.1:4176/play/?preview=story&story=unit-ending&unit=viewport-control&candidate=1) · [2](http://127.0.0.1:4176/play/?preview=story&story=unit-ending&unit=viewport-control&candidate=2) · [3](http://127.0.0.1:4176/play/?preview=story&story=unit-ending&unit=viewport-control&candidate=3) · [4](http://127.0.0.1:4176/play/?preview=story&story=unit-ending&unit=viewport-control&candidate=4) · [5](http://127.0.0.1:4176/play/?preview=story&story=unit-ending&unit=viewport-control&candidate=5) |
| 16 · `real-code-workflow-capstones` | 2 | `artifacts/world-generation/wp11/story-review-v2/unit-endings/real-code-workflow-capstones-restoration-3x4/contact-sheet.jpg` | [1](http://127.0.0.1:4176/play/?preview=story&story=unit-ending&unit=real-code-workflow-capstones&candidate=1) · [2](http://127.0.0.1:4176/play/?preview=story&story=unit-ending&unit=real-code-workflow-capstones&candidate=2) · [3](http://127.0.0.1:4176/play/?preview=story&story=unit-ending&unit=real-code-workflow-capstones&candidate=3) · [4](http://127.0.0.1:4176/play/?preview=story&story=unit-ending&unit=real-code-workflow-capstones&candidate=4) · [5](http://127.0.0.1:4176/play/?preview=story&story=unit-ending&unit=real-code-workflow-capstones&candidate=5) |
| 17 · `mastery-loops` | 5 | `artifacts/world-generation/wp11/story-review-v2/unit-endings/mastery-loops-restoration-3x4/contact-sheet.jpg` | [1](http://127.0.0.1:4176/play/?preview=story&story=unit-ending&unit=mastery-loops&candidate=1) · [2](http://127.0.0.1:4176/play/?preview=story&story=unit-ending&unit=mastery-loops&candidate=2) · [3](http://127.0.0.1:4176/play/?preview=story&story=unit-ending&unit=mastery-loops&candidate=3) · [4](http://127.0.0.1:4176/play/?preview=story&story=unit-ending&unit=mastery-loops&candidate=4) · [5](http://127.0.0.1:4176/play/?preview=story&story=unit-ending&unit=mastery-loops&candidate=5) |

The owner selections were promoted with:

```sh
python scripts/world-art/promote_wp11_story_endings.py \
  --approve viewport-control=4 \
  --approve real-code-workflow-capstones=2 \
  --approve mastery-loops=5
```

The command verifies source hashes and 1792×2400 dimensions, records approval
and rejection states, runs the recorded `cwebp` settings, installs semantic
WebPs, clears all three pending markers, and verifies 17 distinct endings.

## Intro and finale

- [Intro 1 · Connected Wilds](http://127.0.0.1:4176/play/?preview=story&story=intro&panel=connected-wilds)
- [Intro 2 · Interrupted command](http://127.0.0.1:4176/play/?preview=story&story=intro&panel=interrupted-command)
- [Intro 3 · Nix at the threshold](http://127.0.0.1:4176/play/?preview=story&story=intro&panel=nix-at-the-threshold)
- [Final restored Wilds](http://127.0.0.1:4176/play/?preview=story&story=finale)

## Historical mapping

The pre-split WP-11 artifact directory `long-range-navigation` belongs to the
live Unit 9 `position-memory`. Runtime and new review links always use
`position-memory`; the old directory remains only as immutable provenance.
