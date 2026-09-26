# Course Map redesign

**Size:** L. **Depends on:** nothing. **Starts with a design session; nothing
is built until Anton has reviewed the mockups.**

Feedback: `55a895d3` (reorder: free practice must come last) and `5b01da3e`
(the contents should scroll to the current unit when opened).

## Why

The Course Map (the contents dialog) was built on day 1 and has grown one
section at a time since. Nobody has designed it as a whole. It is overloaded,
and it puts the wrong things first. On a phone, the first screen is Free
practice, Mastery and the start of Reference. The course itself, and the unit
the learner is in, sit below four other sections, and the dialog always opens
at the top.

Both reports are symptoms of that. Moving Free practice to the bottom and adding
a scroll would fix the two sentences but not the dialog. The goal here is to
design what the map is for, then build that.

## Where it stands

- `renderTableOfContents()` in `src/dialogs/contents.js` builds the whole sheet
  as one string. The order is Free practice, Mastery, Reference, Story archive,
  the arcs with their units, then ungrouped units. The comment above that line
  defends it: "Free practice stays first: it is the one entry that asks nothing
  of the learner". The redesign should overturn that rationale on purpose, not
  just delete it.
- `openTableOfContents()` renders and calls `showModal()`, and nothing else. The
  close button has `autofocus` (`src/play/index.html`), so the sheet opens at
  the top. The current row is already marked,
  `.toc-activity.current[aria-current="page"]` inside `details.toc-unit[open]`.
  The scroll container is `.dialog-body` (`src/styles/dialogs.css`).
- Both reports' layout checks flagged overflow in the arc headings and dividers
  at 392px: `#toc-arc-*`, `.toc-arc-divider` and `span.toc-number` content is
  one or two pixels taller than its box, and the arc 4 heading wraps to two
  lines.
- Mastery, Reference, Story and Free practice each already have their own
  dialog or surface. The contents sheet is only one of their entry points.

## Scope

### Phase 1: design (ends in a review)

1. **Inventory.** List everything the sheet shows today: sections, arc
   headings, unit, lesson and activity rows, and the badges (track, prerequisite
   warning, recommended, progress). For each item, write down what a learner
   opens the map to do, and whether the item serves that. The likely jobs are
   "where am I", "what's next", "jump to a topic" and "how far have I come".
   Decide which of the secondary destinations belong in this sheet at all, and
   where the others should live instead.
2. **Two directions, then a middle ground.**
   - *Pragmatic:* a plain, scannable table of contents. Current position first,
     calm and dense, nothing decorative.
   - *Gamified:* a journey through the four worlds in `content/presentation.json`
     `worlds` (Moonroot Ruins, Starwater Sanctuary, and the rest). Each world
     has a theme id, ambient effects and a fallback gradient, and there are
     board images in `assets/worlds/`. Reuse those. **Do not generate per-unit
     art** (AGENTS.md: reuse the shared atlas and theme palettes).
   - *Middle ground:* this is the one Anton leans toward. For example, ToC
     structure and density, with each arc taking its world's palette and
     texture, and a clear "you are here". Recommend one version of it.
3. **Mockups** of all three at 360×740 and 430×932, as throwaway HTML or
   screenshots kept out of `src/`. Each must show:
   - what the first screen contains;
   - how progress reads;
   - how a unit expands into lessons and activities;
   - where the secondary destinations went;
   - where the dialog lands when opened from a unit 5 activity.

   **Stop here for review.**

### Phase 2: build the approved design

1. Rewrite `renderTableOfContents()` and the `toc-*` rules in
   `src/styles/dialogs.css` to match.
2. Opening the map scrolls to the current unit and expands it, whichever design
   wins. Mind the close button's `autofocus`, so focus doesn't pull the scroll
   back to the top.
3. Fix the heading and divider overflow above. Confirm at 360, 390, 412, 430 and
   432 wide that nothing clips and the document doesn't scroll.
4. Record the structure and its reasoning in `docs/design-decisions.md`.

## Tests that will change

- `tests/free-practice.spec.js`, "free practice opens from the contents before
  any lesson is finished", asserts that the first `#tocLessons` child is
  `.toc-practice`. Rewrite it for the new home of Free practice. Keep what it
  protects: Free practice is reachable before Unit 1.
- `tests/editor-conformance.spec.js` checks the four arc heading texts, and
  `tests/curriculum-graph.spec.js` the unit warning and recommended markers.
  Keep both of those behaviors unless the design drops them deliberately.
- Add: open the map from a unit 5 activity, and assert that the current row is
  inside the dialog's visible area.

## Constraints

Portrait 360–430 CSS px is the target, and wider screens only center it.
Everything stays within `100dvh` with no document scroll, functional labels are
at least 10–11px, and the map works offline.

## Done when

- Anton has approved a design from phase 1, and it is built.
- The map opens on the learner's current unit.
- The overflow flags are gone at every representative viewport.
- The decision is written down in `docs/design-decisions.md`.
