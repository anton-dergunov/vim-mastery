/**
 * The retention layer's data model, kept free of the DOM, the network and the
 * clock so it can be reasoned about and tested on its own.
 *
 * The curriculum names six steps in its lesson loop and the product implements
 * five: `revisit` has never had a home. This module is that home. It records
 * which activities a learner finished, derives the five product-facing states
 * from `docs/curriculum-and-progression.md`, and builds the drill queues the
 * mastery surface plays back.
 *
 * What it deliberately is not: a knowledge model. The curriculum defers
 * proficiency formulas, decay curves and review intervals, so exactly one
 * function here reads a clock and it is labelled as a placeholder.
 */

export const MASTERY_STATE_KEY = "vim-wilds.mastery.v1";

// Ordered weakest to strongest. `conceptState` returns one of these and never
// returns a weaker one for a larger completion set; the ordering is what makes
// that property expressible as a test.
export const CONCEPT_STATES = Object.freeze(["unseen", "learning", "practiced", "integrated"]);

export const COVERAGE_BUCKETS = Object.freeze(["explain", "demonstrate", "isolate", "mix", "challenge"]);

const emptyState = () => ({ schemaVersion: 1, completions: {}, pinned: [] });

/**
 * Tolerant by design. A blocked, cleared or hand-edited store must cost the
 * learner their history, never a thrown render on launch.
 */
export function readMasteryState(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(MASTERY_STATE_KEY) || "null");
    if (!saved || typeof saved !== "object") return emptyState();
    const completions = {};
    for (const [activityId, record] of Object.entries(saved.completions || {})) {
      if (!record || typeof record !== "object") continue;
      const count = Number.isFinite(record.count) ? Math.max(1, Math.trunc(record.count)) : 1;
      const lastAt = Number.isFinite(record.lastAt) ? record.lastAt : 0;
      completions[activityId] = { count, lastAt };
    }
    const pinned = Array.isArray(saved.pinned) ? saved.pinned.filter(id => typeof id === "string") : [];
    return { schemaVersion: 1, completions, pinned };
  } catch {
    return emptyState();
  }
}

export function writeMasteryState(storage, state) {
  try {
    storage?.setItem(MASTERY_STATE_KEY, JSON.stringify(state));
    return true;
  } catch {
    // A full or blocked store costs one lost record. Never propagate.
    return false;
  }
}

/**
 * Records one finished activity. Pure and idempotent: an activity reset and
 * solved again raises its count and its timestamp, and changes nothing else.
 */
export function recordCompletion(state, { activityId, at = 0 }) {
  if (!activityId) return state;
  const previous = state.completions[activityId];
  return {
    ...state,
    completions: {
      ...state.completions,
      [activityId]: { count: (previous?.count || 0) + 1, lastAt: Math.max(previous?.lastAt || 0, at) },
    },
  };
}

export function togglePinnedConcept(state, conceptId) {
  const pinned = state.pinned.includes(conceptId)
    ? state.pinned.filter(id => id !== conceptId)
    : [...state.pinned, conceptId];
  return { ...state, pinned };
}

/**
 * Reduces a full unit file to the part the mastery layer needs: its coverage
 * arrays, plus the type and delivery of every activity those arrays cite.
 *
 * This is what `content/mastery-index.json` holds. The sixteen unit files come
 * to three megabytes, and the mastery map has to render every concept's state
 * before the learner has chosen anything to drill; parsing all of them to do it
 * would stall the one surface whose job is to open like a map. The digest is
 * about a twentieth of the size, and the unit files still load lazily when a
 * drill actually needs the activities themselves.
 */
export function unitDigest(unit) {
  const cited = new Set(unit.coverage.flatMap(entry => COVERAGE_BUCKETS.flatMap(bucket => entry[bucket] || [])));
  const activities = [];
  for (const lesson of unit.lessons) {
    for (const activity of lesson.activities) {
      if (!cited.has(activity.id)) continue;
      const record = { id: activity.id, lessonId: lesson.id, type: activity.type };
      if (activity.type === "exercise") record.delivery = activity.delivery || "guided-then-recall";
      activities.push(record);
    }
  }
  return { id: unit.id, unitNumber: unit.unitNumber, title: unit.title, activities, coverage: unit.coverage };
}

/**
 * Builds the concept catalog and the reverse index the states are derived from.
 *
 * The buckets are the taxonomy, not `activity.phase`. Thirteen coverage refs in
 * the shipped curriculum sit in a bucket that disagrees with the referenced
 * activity's own phase — `cursor-movement` cites a demo from two `challenge`
 * buckets — and reading `phase` instead would quietly mis-state those concepts.
 */
export function buildConceptIndex(units) {
  const activityIndex = new Map();
  for (const unit of units) {
    for (const activity of unit.activities) {
      activityIndex.set(activity.id, {
        activityId: activity.id,
        unitId: unit.id,
        lessonId: activity.lessonId,
        type: activity.type,
        delivery: activity.delivery || "guided-then-recall",
      });
    }
  }

  const concepts = [];
  for (const unit of units) {
    for (const entry of unit.coverage) {
      const buckets = {};
      const refs = new Map();
      for (const bucket of COVERAGE_BUCKETS) {
        buckets[bucket] = (entry[bucket] || []).map(activityId => {
          const ref = activityIndex.get(activityId);
          if (!ref) throw new Error(`coverage entry ${entry.id} references unknown activity ${activityId}`);
          refs.set(activityId, ref);
          return ref;
        });
      }
      concepts.push({
        id: entry.id,
        concept: entry.concept,
        unitId: unit.id,
        unitNumber: unit.unitNumber,
        unitTitle: unit.title,
        buckets,
        refs: [...refs.values()],
      });
    }
  }

  const byId = new Map(concepts.map(concept => [concept.id, concept]));
  const byActivityId = new Map();
  for (const concept of concepts) {
    for (const bucket of COVERAGE_BUCKETS) {
      for (const ref of concept.buckets[bucket]) {
        if (!byActivityId.has(ref.activityId)) byActivityId.set(ref.activityId, []);
        byActivityId.get(ref.activityId).push({ conceptId: concept.id, bucket });
      }
    }
  }
  return { concepts, byId, byActivityId, activityIndex };
}

const isCompleted = (completions, ref) => Boolean(completions[ref.activityId]);

/**
 * The five product-facing states, minus the fifth: `maintenance due` is not a
 * state here. See `isMaintenanceDue` — an achieved state that could fall back
 * down would show a learner their own progress decaying through no action of
 * theirs, so staleness is reported beside the state and never instead of it.
 *
 * A completed demo is evidence of `learning` and nothing more, whichever bucket
 * cites it. Watching an animation is not an isolated application.
 */
export function conceptState(concept, completions = {}) {
  const evidence = bucket => concept.buckets[bucket].some(ref => isCompleted(completions, ref));
  const practice = bucket => concept.buckets[bucket].some(ref => ref.type !== "demo" && isCompleted(completions, ref));
  if (practice("mix") || practice("challenge")) return "integrated";
  if (practice("isolate")) return "practiced";
  if (COVERAGE_BUCKETS.some(evidence)) return "learning";
  return "unseen";
}

export function conceptStateRank(state) {
  return CONCEPT_STATES.indexOf(state);
}

export function lastTouchedAt(concept, completions = {}) {
  return concept.refs.reduce((latest, ref) => Math.max(latest, completions[ref.activityId]?.lastAt || 0), 0);
}

export const MAINTENANCE_STALE_SECONDS = 21 * 24 * 60 * 60;

/**
 * The placeholder, and the only function here that reads a clock.
 *
 * `docs/curriculum-and-progression.md` is explicit that the five states define
 * product language and not "a scoring, decay, scheduling, or knowledge-tracing
 * algorithm", and that those mechanics are deferred. This is therefore the
 * simplest rule that can surface the state at all: an integrated concept nobody
 * has touched in three weeks is worth revisiting. It is meant to be replaced by
 * a real scheduler, and nothing else in the product should grow to depend on
 * its particular shape.
 */
export function isMaintenanceDue(concept, completions = {}, now = 0, staleSeconds = MAINTENANCE_STALE_SECONDS) {
  if (conceptState(concept, completions) !== "integrated") return false;
  const touched = lastTouchedAt(concept, completions);
  return touched > 0 && now - touched >= staleSeconds;
}

/**
 * A concept is replayable once the learner has actually applied it. Explaining
 * and demonstrating are the product's work, not the learner's, so `learning` is
 * not enough to put a topic into review.
 */
export function isEligibleForReview(concept, completions = {}) {
  return conceptStateRank(conceptState(concept, completions)) >= conceptStateRank("practiced");
}

export function eligibleConcepts(index, completions = {}) {
  return index.concepts.filter(concept => isEligibleForReview(concept, completions));
}

/**
 * Which form of an exercise a drill should play.
 *
 * Recall is the one "advanced variant" dimension the product can honestly
 * offer: it already exists as authored data, withholding the prompt and the
 * next-key guidance. The author's `delivery` decides whether it exists for a
 * given exercise, and ten shipped exercises have no guided form while seven
 * have no recall form, so this is a lookup and never a default.
 */
export function practiceModeFor(ref) {
  if (ref.type !== "exercise") return null;
  return ref.delivery === "guided" ? "guided" : "recall";
}

const drillable = ref => ref.type === "exercise" || ref.type === "choice";

const stepFor = ref => ({
  unitId: ref.unitId,
  activityId: ref.activityId,
  practiceMode: practiceModeFor(ref),
});

/**
 * One concept, replayed in the order the curriculum builds it: apply in
 * isolation, compose with older commands, then select it unaided. Demos and
 * theory are left out — a drill is retrieval, and watching is not retrieving.
 */
export function buildFocusedPlan(concept) {
  const seen = new Set();
  const steps = [];
  for (const bucket of ["isolate", "mix", "challenge"]) {
    for (const ref of concept.buckets[bucket]) {
      if (!drillable(ref) || seen.has(ref.activityId)) continue;
      seen.add(ref.activityId);
      steps.push(stepFor(ref));
    }
  }
  return steps.length ? { kind: "focused", conceptIds: [concept.id], steps } : null;
}

/**
 * Interleaves two to five learned families so the learner has to retrieve *and*
 * select. Round-robin rather than block order is the whole point: consecutive
 * items from one concept let the learner coast on the previous answer.
 */
export function buildMixedPlan(concepts, { length = 8, random = Math.random } = {}) {
  const usable = concepts.filter(concept => buildFocusedPlan(concept));
  if (usable.length < 2) return null;
  const chosen = shuffle(usable, random).slice(0, 5);
  const families = chosen.map(concept => shuffle(buildFocusedPlan(concept).steps, random));
  const steps = [];
  while (steps.length < length && families.some(family => family.length)) {
    for (const family of families) {
      if (!family.length || steps.length >= length) continue;
      steps.push(family.shift());
    }
  }
  return steps.length ? { kind: "mixed", conceptIds: chosen.map(concept => concept.id), steps } : null;
}

/**
 * Tool choice as a mode rather than as a scattering of activities: the
 * transformation is presented before the mechanism is named, drawn only from
 * families the learner has already applied.
 */
export function buildToolChoicePlan(concepts, { length = 6, random = Math.random } = {}) {
  const steps = [];
  const seen = new Set();
  for (const concept of shuffle(concepts, random)) {
    for (const ref of concept.buckets.challenge) {
      if (ref.type !== "choice" || seen.has(ref.activityId)) continue;
      seen.add(ref.activityId);
      steps.push(stepFor(ref));
    }
  }
  return steps.length ? { kind: "tool-choice", conceptIds: concepts.map(concept => concept.id), steps: steps.slice(0, length) } : null;
}

function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

/**
 * Per-unit rollup for the mastery map. Reads only the persisted completions and
 * the catalog's `conceptCount`, so the map can open without fetching a single
 * unit file; the concepts themselves load when a drill actually needs them.
 */
export function summarizeUnit(index, unitId, completions = {}, now = 0) {
  const concepts = index.concepts.filter(concept => concept.unitId === unitId);
  const counts = { unseen: 0, learning: 0, practiced: 0, integrated: 0 };
  let maintenanceDue = 0;
  for (const concept of concepts) {
    counts[conceptState(concept, completions)] += 1;
    if (isMaintenanceDue(concept, completions, now)) maintenanceDue += 1;
  }
  return { unitId, total: concepts.length, counts, maintenanceDue };
}
